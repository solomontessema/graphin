<?php
declare(strict_types=1);

// Graphin entry point. The API lives under /api. Any other path serves the built React app,
// so the PHP server (or Apache) serves the whole product from one origin.

// With the PHP built-in server, this file is the router. Real files in public/ (the built JS and CSS,
// images) are served as they are; only other paths reach the app below.
$requested = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (PHP_SAPI === 'cli-server' && $requested !== '/' && is_file(__DIR__ . $requested)) {
    return false;
}

require __DIR__ . '/../vendor/autoload.php';

use Graphin\ApiException;
use Graphin\Auth;
use Graphin\Controllers\AuthController;
use Graphin\Controllers\EdgeController;
use Graphin\Controllers\NetworkController;
use Graphin\Controllers\NodeController;
use Graphin\Controllers\PageController;
use Graphin\Database;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;

$root = dirname(__DIR__);

// Settings come from .env (KEY=VALUE lines, # for comments). A real environment variable wins over
// .env, so the desktop app can set its own settings and needs no .env file.
$env = [];
if (is_file($root . '/.env')) {
    foreach (file($root . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line[0] === '#' || strpos($line, '=') === false) {
            continue;
        }
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        $env[$key] = $value;
    }
}
foreach (['APP_DEBUG', 'DB_DRIVER', 'DB_PATH', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS', 'DB_CHARSET', 'AUTH_REQUIRED'] as $key) {
    $value = getenv($key);
    if ($value !== false) {
        $env[$key] = $value;
    }
}
$debug = strtolower($env['APP_DEBUG'] ?? '') === 'true';

$db = new Database([
    'driver' => $env['DB_DRIVER'] ?? 'mysql',
    'path' => $env['DB_PATH'] ?? '',
    'host' => $env['DB_HOST'] ?? '127.0.0.1',
    'port' => $env['DB_PORT'] ?? '3306',
    'name' => $env['DB_NAME'] ?? 'graphin',
    'user' => $env['DB_USER'] ?? 'root',
    'pass' => $env['DB_PASS'] ?? '',
    'charset' => $env['DB_CHARSET'] ?? 'utf8mb4',
]);
// The desktop database is a file that starts empty. Create its tables the first time it is used.
if ($db->driver() === 'sqlite') {
    $db->applySchema($root . '/schema-sqlite.sql');
    // Databases made before appearance settings existed get the new column. SQLite cannot add it
    // with IF NOT EXISTS, so the column list is checked first.
    $db->ensureColumn('nodes', 'style', 'TEXT NULL');
    $db->ensureColumn('edges', 'style', 'TEXT NULL');
    $db->ensureColumn('nodes', 'event_time', 'TEXT NULL');
    $db->ensureColumn('nodes', 'latitude', 'REAL NULL');
    $db->ensureColumn('nodes', 'longitude', 'REAL NULL');
    $db->ensureColumn('nodes', 'country', 'TEXT NULL');
    $db->ensureColumn('nodes', 'refs', 'TEXT NULL');
    $db->ensureColumn('nodes', 'tags', 'TEXT NULL');
    $db->ensureColumn('edges', 'tags', 'TEXT NULL');
    $db->ensureColumn('networks', 'tag_colors', 'TEXT NULL');
    $db->ensureColumn('networks', 'cover_url', 'TEXT NULL');
    $db->ensureColumn('networks', 'tile_color', 'TEXT NULL');
    // Unused on the desktop (no accounts), but the same queries run there.
    $db->ensureColumn('networks', 'user_id', 'TEXT NULL');
    // Containers (groups) no longer exist. Remove any an older database still holds, with their links.
    $db->execute("DELETE FROM edges WHERE relationship = 'BELONGS_TO'");
    $db->execute("DELETE FROM nodes WHERE type = 'group'");
}

// Accounts are used by the web product (MariaDB). The desktop app (SQLite) is one person's own computer and has none,
// unless AUTH_REQUIRED=true is set.
$authRequired = isset($env['AUTH_REQUIRED']) ? strtolower($env['AUTH_REQUIRED']) === 'true' : $db->driver() !== 'sqlite';
Auth::configure($authRequired);
if ($authRequired && str_starts_with($requested, '/api')) {
    // The session lives in an HttpOnly cookie that is sent only from this site's own pages.
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    ini_set('session.gc_maxlifetime', (string) (60 * 60 * 24 * 30));
    session_start();
    Auth::setUser(isset($_SESSION['user_id']) ? (string) $_SESSION['user_id'] : null);
}

$app = AppFactory::create();
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

// Every error inside /api is returned as JSON. Only ApiException messages reach the client
// unless APP_DEBUG is on.
$errors = $app->addErrorMiddleware($debug, true, true);
$errors->setDefaultErrorHandler(function (Request $request, Throwable $e) use ($app, $debug): Response {
    $response = $app->getResponseFactory()->createResponse();
    if ($e instanceof ApiException) {
        $status = $e->status();
        $message = $e->getMessage();
    } else {
        $status = 500;
        $message = $debug ? $e->getMessage() : 'Something went wrong.';
    }
    $response->getBody()->write((string) json_encode(['error' => $message]));
    return $response->withHeader('Content-Type', 'application/json')->withStatus($status);
});

$app->get('/api/health', function (Request $request, Response $response): Response {
    $response->getBody()->write((string) json_encode(['status' => 'ok']));
    return $response->withHeader('Content-Type', 'application/json');
});

// Every request that changes something must carry this header. A page on another site cannot add it without the
// browser first asking this server for permission (which it never gives), so forged requests are refused.
$app->add(function (Request $request, \Psr\Http\Server\RequestHandlerInterface $handler) use ($app, $authRequired): Response {
    $path = $request->getUri()->getPath();
    if (!str_starts_with($path, '/api')) {
        return $handler->handle($request);
    }
    $reply = function (int $status, string $message) use ($app): Response {
        $response = $app->getResponseFactory()->createResponse($status);
        $response->getBody()->write((string) json_encode(['error' => $message]));
        return $response->withHeader('Content-Type', 'application/json');
    };
    if ($authRequired && !in_array($request->getMethod(), ['GET', 'HEAD', 'OPTIONS'], true) && $request->getHeaderLine('X-Requested-With') !== 'graphin') {
        return $reply(403, 'This request did not come from Graphin.');
    }
    // Everything except health and signing in needs a signed-in user.
    $open = $path === '/api/health' || str_starts_with($path, '/api/auth/');
    if ($authRequired && !$open && Auth::userId() === null) {
        return $reply(401, 'Please log in.');
    }
    return $handler->handle($request);
});

$app->get('/api/auth/me', [new AuthController($db), 'me']);
$app->post('/api/auth/register', [new AuthController($db), 'register']);
$app->post('/api/auth/login', [new AuthController($db), 'login']);
$app->post('/api/auth/logout', [new AuthController($db), 'logout']);

$app->get('/api/networks', [new NetworkController($db), 'index']);
$app->post('/api/networks', [new NetworkController($db), 'store']);
$app->put('/api/networks/{id}', [new NetworkController($db), 'update']);
$app->delete('/api/networks/{id}', [new NetworkController($db), 'destroy']);
$app->get('/api/networks/{id}/graph', [new NetworkController($db), 'graph']);
$app->put('/api/networks/{id}/positions', [new NetworkController($db), 'positions']);
$app->put('/api/networks/{id}/restore', [new NetworkController($db), 'restore']);
$app->get('/api/embeddable', [new PageController($db), 'embeddable']);

$app->post('/api/networks/{id}/nodes', [new NodeController($db), 'store']);
$app->put('/api/nodes/{id}', [new NodeController($db), 'update']);
$app->delete('/api/nodes/{id}', [new NodeController($db), 'destroy']);

$app->post('/api/networks/{id}/edges', [new EdgeController($db), 'store']);
$app->put('/api/edges/{id}', [new EdgeController($db), 'update']);
$app->delete('/api/edges/{id}', [new EdgeController($db), 'destroy']);

// Anything that is not /api serves the built React app. Client-side routes (such as /capture)
// fall back to index.html.
$app->get('/{path:.*}', function (Request $request, Response $response): Response {
    $index = dirname(__DIR__) . '/public/index.html';
    if (!is_file($index)) {
        $response->getBody()->write('Graphin frontend is not built. Run "npm run build" in frontend/.');
        return $response->withStatus(503)->withHeader('Content-Type', 'text/plain');
    }
    $response->getBody()->write((string) file_get_contents($index));
    return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
});

$app->run();
