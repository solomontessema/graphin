<?php
declare(strict_types=1);

namespace Graphin\Controllers;

use Graphin\Accounts;
use Graphin\ApiException;
use Graphin\Auth;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Accounts. The email address is the username. Sessions are PHP sessions in an HttpOnly cookie, and passwords are
 * stored only as password_hash() values. A new account must confirm its email address before it can log in.
 * Confirming, resetting a password and the links sent by email are in AccountController.
 */
final class AuthController extends BaseController
{
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

    /**
     * POST /api/auth/register {email, password} : creates the account and emails a link to confirm the address. The
     * person is not signed in until the link is used, so the reply has no user.
     */
    public function register(Request $request, Response $response): Response
    {
        $this->needAccounts();
        $data = $this->body($request);
        $email = Accounts::email($data);
        $password = Accounts::password($data, true);
        $firstName = Accounts::name($data, 'first_name');
        $lastName = Accounts::name($data, 'last_name');
        if ($this->db->fetchOne('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
            throw new ApiException(409, 'An account with this email address already exists. Log in instead.');
        }
        $id = \Graphin\Database::uuid();
        $this->db->execute(
            'INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
            [$id, $email, password_hash($password, PASSWORD_DEFAULT), $firstName, $lastName]
        );
        Accounts::sendVerification($this->db, $id, $email);
        return $this->json($response, ['mode' => 'accounts', 'user' => null, 'pending_verification' => true, 'email' => $email], 201);
    }

    /** POST /api/auth/login {email, password} */
    public function login(Request $request, Response $response): Response
    {
        $this->needAccounts();
        $data = $this->body($request);
        $email = Accounts::email($data);
        $password = Accounts::password($data, false);
        $user = $this->db->fetchOne('SELECT id, email, password_hash, email_verified_at FROM users WHERE email = ?', [$email]);
        // Unknown emails are checked against a throwaway hash, so the answer takes as long either way.
        $hash = $user['password_hash'] ?? '$2y$10$usesomesillystringforsaleuseenoughrandomsaltxyzabcdefghijkl';
        $ok = password_verify($password, $hash) && $user !== null;
        if (!$ok) {
            // Slows down guessing.
            usleep(600000);
            throw new ApiException(401, 'The email address or password is not right.');
        }
        // Only the owner of the password learns that the address is not confirmed yet.
        if ($user['email_verified_at'] === null) {
            throw new ApiException(403, 'Confirm your email address first. Use the link we emailed you, or ask for a new one.');
        }
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $this->db->execute('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        Accounts::signIn($user['id']);
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
}
