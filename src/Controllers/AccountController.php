<?php
declare(strict_types=1);

namespace Graphin\Controllers;

use Graphin\Accounts;
use Graphin\ApiException;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * The links sent by email: confirming a new address, and resetting a forgotten password. The replies that go to
 * someone who typed an email address do not say whether an account exists for it.
 */
final class AccountController extends BaseController
{
    /** POST /api/auth/verify {token} : confirms the address of a new account and signs the person in. */
    public function verify(Request $request, Response $response): Response
    {
        $this->needAccounts();
        $token = $this->token($this->body($request));
        $userId = Accounts::consume($this->db, $token, Accounts::VERIFY);
        $this->db->execute('UPDATE users SET email_verified_at = UTC_TIMESTAMP(3) WHERE id = ? AND email_verified_at IS NULL', [$userId]);
        $user = $this->db->fetchOne('SELECT id, email FROM users WHERE id = ?', [$userId]);
        if ($user === null) {
            throw new ApiException(400, 'This link is not valid. Ask for a new one.');
        }
        Accounts::signIn($user['id']);
        return $this->json($response, ['mode' => 'accounts', 'user' => ['id' => $user['id'], 'email' => $user['email']]]);
    }

    /** POST /api/auth/resend-verification {email} : emails a new confirmation link to an account that is not confirmed yet. */
    public function resendVerification(Request $request, Response $response): Response
    {
        $this->needAccounts();
        $email = Accounts::email($this->body($request));
        $user = $this->db->fetchOne('SELECT id, email, email_verified_at FROM users WHERE email = ?', [$email]);
        if ($user !== null && $user['email_verified_at'] === null) {
            Accounts::sendVerification($this->db, $user['id'], $user['email']);
        }
        return $this->json($response, ['message' => 'If that address is waiting to be confirmed, we have sent a new link.']);
    }

    /** POST /api/auth/forgot-password {email} : emails a link to choose a new password. */
    public function forgotPassword(Request $request, Response $response): Response
    {
        $this->needAccounts();
        $email = Accounts::email($this->body($request));
        $user = $this->db->fetchOne('SELECT id, email FROM users WHERE email = ?', [$email]);
        if ($user !== null) {
            Accounts::sendReset($this->db, $user['id'], $user['email']);
        }
        return $this->json($response, ['message' => 'If an account exists for that email address, we have sent a link to reset its password.']);
    }

    /**
     * POST /api/auth/reset-password {token, password} : sets a new password. Using the link proves the person owns the
     * address, so an unconfirmed address is confirmed too. The person then logs in with the new password.
     */
    public function resetPassword(Request $request, Response $response): Response
    {
        $this->needAccounts();
        $data = $this->body($request);
        $token = $this->token($data);
        $password = Accounts::password($data, true);
        $userId = Accounts::consume($this->db, $token, Accounts::RESET);
        $this->db->execute(
            'UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP(3)) WHERE id = ?',
            [password_hash($password, PASSWORD_DEFAULT), $userId]
        );
        // Any other reset link sent before this one stops working.
        $this->db->execute('UPDATE account_tokens SET used_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND used_at IS NULL', [$userId]);
        return $this->json($response, ['message' => 'Your password has been changed. Log in with the new password.']);
    }

    /** @param array<string, mixed> $data */
    private function token(array $data): string
    {
        $token = trim((string) ($data['token'] ?? ''));
        if ($token === '') {
            throw new ApiException(400, 'This link is not valid. Ask for a new one.');
        }
        return $token;
    }

    private function needAccounts(): void
    {
        if (!\Graphin\Auth::required()) {
            throw new ApiException(404, 'This copy of Graphin does not use accounts.');
        }
    }
}
