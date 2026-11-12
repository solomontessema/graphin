<?php
declare(strict_types=1);

// Creates a user, or resets the password of an existing one, from the command line. With --adopt the user also takes
// over every network that has no owner yet (the networks made before accounts existed).
//
//   php bin/create-user.php someone@example.com "a password" [--adopt]
//
// Reads the database settings from .env in the same way as the web app.

require __DIR__ . '/../vendor/autoload.php';

use Graphin\Database;

[$script, $email, $password] = array_pad($argv, 3, null);
if (!$email || !$password || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Usage: php bin/create-user.php email password [--adopt]\n");
    exit(1);
}
$email = strtolower(trim($email));

$env = [];
$envFile = __DIR__ . '/../.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line[0] === '#' || strpos($line, '=') === false) {
            continue;
        }
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        $env[$key] = $value;
    }
}
$db = new Database([
    'driver' => 'mysql',
    'host' => $env['DB_HOST'] ?? '127.0.0.1',
    'port' => $env['DB_PORT'] ?? '3306',
    'name' => $env['DB_NAME'] ?? 'graphin',
    'user' => $env['DB_USER'] ?? 'root',
    'pass' => $env['DB_PASS'] ?? '',
    'charset' => $env['DB_CHARSET'] ?? 'utf8mb4',
]);

$hash = password_hash($password, PASSWORD_DEFAULT);
$existing = $db->fetchOne('SELECT id FROM users WHERE email = ?', [$email]);
if ($existing) {
    $id = $existing['id'];
    $db->execute('UPDATE users SET password_hash = ? WHERE id = ?', [$hash, $id]);
    echo "Updated the password of $email\n";
} else {
    $id = Database::uuid();
    // Made by hand here, so the address is trusted: no confirmation email is needed.
    $db->execute('INSERT INTO users (id, email, password_hash, email_verified_at) VALUES (?, ?, ?, UTC_TIMESTAMP(3))', [$id, $email, $hash]);
    echo "Created $email\n";
}
if (in_array('--adopt', $argv, true)) {
    $count = $db->execute('UPDATE networks SET user_id = ? WHERE user_id IS NULL', [$id]);
    echo "$count existing network(s) now belong to $email\n";
}
