<?php
declare(strict_types=1);

namespace Graphin;

use DateTimeImmutable;
use DateTimeZone;

/**
 * Account rules shared by sign-up, log-in, email confirmation and password reset: how an email address and a password
 * are checked, the one-time links that are sent by email, signing in, and sending the email itself.
 *
 * A link is a random token. Only its SHA-256 hash is stored, it works once, and it expires: 48 hours to confirm an
 * address, one hour to reset a password. Asking for a new link makes the older unused ones of that kind stop working.
 */
final class Accounts
{
    public const VERIFY = 'verify';
    public const RESET = 'reset';

    public const PASSWORD_MIN = 8;
    private const PASSWORD_MAX = 200;
    private const EMAIL_MAX = 254;
    private const NAME_MAX = 100;
    private const VERIFY_SECONDS = 60 * 60 * 48;
    private const RESET_SECONDS = 60 * 60;
    /** A new link is not sent again within this many seconds of the last one (stops mail flooding). */
    private const RESEND_WAIT = 60;

    private static string $appUrl = '';
    private static string $mailFrom = 'no-reply@graphin.org';
    private static string $mailDriver = 'mail';
    private static string $logFile = '';

    /**
     * $siteUrl is the address this copy is served from, used when APP_URL is not set. MAIL_DRIVER=log writes the emails
     * to storage/mail.log instead of sending them, for development.
     *
     * @param array<string, string> $env
     */
    public static function configure(array $env, string $siteUrl, string $root): void
    {
        self::$appUrl = rtrim($env['APP_URL'] ?? $siteUrl, '/');
        self::$mailFrom = $env['MAIL_FROM'] ?? self::$mailFrom;
        self::$mailDriver = strtolower($env['MAIL_DRIVER'] ?? 'mail');
        self::$logFile = $root . '/storage/mail.log';
    }

    /** @param array<string, mixed> $data */
    public static function email(array $data): string
    {
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        if ($email === '' || strlen($email) > self::EMAIL_MAX || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new ApiException(422, 'Enter a valid email address. It is your username.');
        }
        return $email;
    }

    /** A first or last name given at sign-up, as typed (trimmed). @param array<string, mixed> $data */
    public static function name(array $data, string $field): string
    {
        $name = trim((string) ($data[$field] ?? ''));
        if ($name === '' || mb_strlen($name) > self::NAME_MAX) {
            throw new ApiException(422, $field === 'first_name' ? 'Enter your first name.' : 'Enter your last name.');
        }
        return $name;
    }

    /** @param array<string, mixed> $data */
    public static function password(array $data, bool $checkLength): string
    {
        $password = $data['password'] ?? '';
        if (!is_string($password) || $password === '' || strlen($password) > self::PASSWORD_MAX) {
            throw new ApiException(422, 'Enter your password.');
        }
        if ($checkLength && strlen($password) < self::PASSWORD_MIN) {
            throw new ApiException(422, 'Choose a password of at least ' . self::PASSWORD_MIN . ' characters.');
        }
        return $password;
    }

    /** Starts a session for a user: a new session id each time, so an id known before cannot be used after. */
    public static function signIn(string $userId): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        Auth::setUser($userId);
    }

    /** Sends a link to confirm the address of a new account. Asking again sooner than RESEND_WAIT does nothing. */
    public static function sendVerification(Database $db, string $userId, string $email): void
    {
        $token = self::issue($db, $userId, self::VERIFY, self::VERIFY_SECONDS);
        if ($token === null) {
            return;
        }
        self::send(
            $email,
            'Confirm your Graphin email address',
            "Hello,\n\nThanks for creating a Graphin account. Confirm your email address to start using it:\n\n"
            . self::link('verify', $token)
            . "\n\nThe link works for 48 hours. If you did not create an account, you can ignore this email.\n\nGraphin"
        );
    }

    /** Sends a link to choose a new password. Asking again sooner than RESEND_WAIT does nothing. */
    public static function sendReset(Database $db, string $userId, string $email): void
    {
        $token = self::issue($db, $userId, self::RESET, self::RESET_SECONDS);
        if ($token === null) {
            return;
        }
        self::send(
            $email,
            'Reset your Graphin password',
            "Hello,\n\nWe received a request to reset the password of your Graphin account. Choose a new one here:\n\n"
            . self::link('reset', $token)
            . "\n\nThe link works for one hour. If you did not ask for this, you can ignore this email; your password stays the same.\n\nGraphin"
        );
    }

    /**
     * Checks a link the person clicked and uses it up. Returns the id of the user it belongs to.
     *
     * @throws ApiException when the link is unknown, already used or expired
     */
    public static function consume(Database $db, string $token, string $purpose): string
    {
        $row = preg_match('/^[a-f0-9]{64}$/', $token)
            ? $db->fetchOne('SELECT id, user_id, expires_at, used_at FROM account_tokens WHERE token_hash = ? AND purpose = ?', [hash('sha256', $token), $purpose])
            : null;
        if ($row === null) {
            throw new ApiException(400, 'This link is not valid. Ask for a new one.');
        }
        if ($row['used_at'] !== null) {
            throw new ApiException(400, 'This link has already been used. Ask for a new one if you still need it.');
        }
        $expires = new DateTimeImmutable((string) $row['expires_at'], new DateTimeZone('UTC'));
        if ($expires < new DateTimeImmutable('now', new DateTimeZone('UTC'))) {
            throw new ApiException(400, 'This link has expired. Ask for a new one.');
        }
        // Claimed in one step, so two clicks at the same moment cannot both succeed.
        if ($db->execute('UPDATE account_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = ? AND used_at IS NULL', [$row['id']]) === 0) {
            throw new ApiException(400, 'This link has already been used. Ask for a new one if you still need it.');
        }
        return (string) $row['user_id'];
    }

    /** Makes a link for a user. Returns null when one was sent less than RESEND_WAIT seconds ago. */
    private static function issue(Database $db, string $userId, string $purpose, int $lifetime): ?string
    {
        $recent = $db->fetchOne(
            'SELECT id FROM account_tokens WHERE user_id = ? AND purpose = ? AND created_at > UTC_TIMESTAMP(3) - INTERVAL ' . self::RESEND_WAIT . ' SECOND',
            [$userId, $purpose]
        );
        if ($recent !== null) {
            return null;
        }
        // The older unused links of this kind stop working.
        $db->execute('UPDATE account_tokens SET used_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [$userId, $purpose]);

        $token = bin2hex(random_bytes(32));
        $now = gmdate('Y-m-d H:i:s');
        $db->execute(
            'INSERT INTO account_tokens (id, user_id, purpose, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
            [Database::uuid(), $userId, $purpose, hash('sha256', $token), $now, gmdate('Y-m-d H:i:s', time() + $lifetime)]
        );
        return $token;
    }

    private static function link(string $page, string $token): string
    {
        return self::$appUrl . '/#/' . $page . '?token=' . $token;
    }

    private static function send(string $to, string $subject, string $body): void
    {
        if (self::$mailDriver === 'log') {
            if (!is_dir(dirname(self::$logFile))) {
                mkdir(dirname(self::$logFile), 0775, true);
            }
            file_put_contents(self::$logFile, "To: $to\nSubject: $subject\n\n$body\n\n-----\n", FILE_APPEND | LOCK_EX);
            return;
        }
        $headers = 'From: ' . self::$mailFrom . "\r\nContent-Type: text/plain; charset=UTF-8";
        if (!mail($to, $subject, $body, $headers)) {
            error_log('Graphin could not send an email to ' . $to . ': ' . $subject);
        }
    }
}
