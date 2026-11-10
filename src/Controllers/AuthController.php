<?php
declare(strict_types=1);

namespace Graphin\Controllers;

use Graphin\ApiException;
use Graphin\Auth;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Accounts. The email address is the username. Sessions are PHP sessions in an HttpOnly cookie, and passwords are
 * stored only as password_hash() values.
 */
final class AuthController extends BaseController
{
    public const PASSWORD_MIN = 8;
    private const PASSWORD_MAX = 200;
    private const EMAIL_MAX = 254;

    /** GET /api/auth/me : who is signed in. {mode: "local"} means no accounts are used (the desktop app). */
    public function me(Request $request, Response $response): Response
    {
        if (!Auth::required()) {
            return $this->json($response, ['mode' => 'local', 'user' => null]);
        }
        $user = null;
        if (Auth::userId() !== null) {
            $row = $this->db->fetchOne('SELECT id, email FROM users WHERE id = ?', [Auth::userId()]);
            $user = $row === null ? null : ['id' => $row['id'], 'email' => $row['email']];
        }
        return $this->json($response, ['mode' => 'accounts', 'user' => $user]);
    }

    /** POST /api/auth/register {email, password} : creates the account and signs it in. */
    public function register(Request $request, Response $response): Response
    {
        $this->needAccounts();
        $data = $this->body($request);
        $email = $this->email($data);
        $password = $this->password($data, true);
        if ($this->db->fetchOne('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
            throw new ApiException(409, 'An account with this email address already exists. Log in instead.');
        }
        $id = \Graphin\Database::uuid();
        $this->db->execute(
            'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
            [$id, $email, password_hash($password, PASSWORD_DEFAULT)]
        );
        $this->signIn($id);
        return $this->json($response, ['mode' => 'accounts', 'user' => ['id' => $id, 'email' => $email]], 201);
    }

    /** POST /api/auth/login {email, password} */
    public function login(Request $request, Response $response): Response
    {
        $this->needAccounts();
        $data = $this->body($request);
        $email = $this->email($data);
        $password = $this->password($data, false);
        $user = $this->db->fetchOne('SELECT id, email, password_hash FROM users WHERE email = ?', [$email]);
        // Unknown emails are checked against a throwaway hash, so the answer takes as long either way.
        $hash = $user['password_hash'] ?? '$2y$10$usesomesillystringforsaleuseenoughrandomsaltxyzabcdefghijkl';
        $ok = password_verify($password, $hash) && $user !== null;
        if (!$ok) {
            // Slows down guessing.
            usleep(600000);
            throw new ApiException(401, 'The email address or password is not right.');
        }
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $this->db->execute('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        $this->signIn($user['id']);
        return $this->json($response, ['mode' => 'accounts', 'user' => ['id' => $user['id'], 'email' => $user['email']]]);
    }

    /** POST /api/auth/logout */
    public function logout(Request $request, Response $response): Response
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION = [];
            session_regenerate_id(true);
            session_destroy();
        }
        Auth::setUser(null);
        return $this->json($response, ['mode' => Auth::required() ? 'accounts' : 'local', 'user' => null]);
    }

    private function needAccounts(): void
    {
        if (!Auth::required()) {
            throw new ApiException(404, 'This copy of Graphin does not use accounts.');
        }
    }

    private function signIn(string $userId): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        // A new session id on every sign-in, so an id known before it cannot be used after.
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        Auth::setUser($userId);
    }

    /** @param array<string, mixed> $data */
    private function email(array $data): string
    {
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        if ($email === '' || strlen($email) > self::EMAIL_MAX || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new ApiException(422, 'Enter a valid email address. It is your username.');
        }
        return $email;
    }

    /** @param array<string, mixed> $data */
    private function password(array $data, bool $checkLength): string
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
}
