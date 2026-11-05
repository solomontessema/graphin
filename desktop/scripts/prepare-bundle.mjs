// Gathers everything the desktop app ships with into src-tauri/bundle:
//   - the built web app (public/), the PHP code (src/, vendor/), and the SQLite schema,
//   - a PHP runtime with the SQLite extension, copied from an existing PHP installation.
// Run with: npm run bundle   (npm run build and npm run dev run it for you)
//
// The PHP folder defaults to C:\xampp\php. Point GRAPHIN_PHP_DIR at another PHP 8.x (thread-safe, Windows) if needed.

import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const desktop = resolve(here, '..');
const root = resolve(desktop, '..');
const out = join(desktop, 'src-tauri', 'bundle');
const phpSource = process.env.GRAPHIN_PHP_DIR || 'C:\\xampp\\php';

// Files the PHP runtime needs to start with the SQLite extension. The Visual C++ runtime DLLs are
// copied when the PHP folder has them; most Windows machines already have them installed.
const PHP_FILES = ['php.exe', 'php8ts.dll'];
const PHP_EXTENSIONS = ['php_pdo_sqlite.dll', 'php_mbstring.dll'];
const VC_RUNTIME = ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll'];

function need(path, what) {
  if (!existsSync(path)) {
    throw new Error(`${what} not found: ${path}`);
  }
  return path;
}

// 1. The web app: the frontend build writes into ../public.
console.log('Building the web app…');
execSync('npm run build', { cwd: join(root, 'frontend'), stdio: 'inherit', shell: true });

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'php', 'ext'), { recursive: true });

cpSync(need(join(root, 'public'), 'Built app'), join(out, 'public'), { recursive: true });
cpSync(need(join(root, 'src'), 'PHP source'), join(out, 'src'), { recursive: true });
cpSync(need(join(root, 'vendor'), 'PHP dependencies (run composer install)'), join(out, 'vendor'), { recursive: true });
copyFileSync(need(join(root, 'schema-sqlite.sql'), 'SQLite schema'), join(out, 'schema-sqlite.sql'));

// 2. The PHP runtime.
console.log(`Copying PHP from ${phpSource}…`);
for (const file of PHP_FILES) {
  copyFileSync(need(join(phpSource, file), 'PHP'), join(out, 'php', file));
}
for (const file of PHP_EXTENSIONS) {
  copyFileSync(need(join(phpSource, 'ext', file), 'PHP extension'), join(out, 'php', 'ext', file));
}
for (const file of VC_RUNTIME) {
  const path = join(phpSource, file);
  if (existsSync(path)) {
    copyFileSync(path, join(out, 'php', file));
  }
}

// 3. Check that the runtime works on its own, with no php.ini, before the app is built.
const check = execSync(
  `"${join(out, 'php', 'php.exe')}" -n -d extension_dir="${join(out, 'php', 'ext')}" -d extension=pdo_sqlite -d extension=mbstring -r "echo in_array('sqlite', PDO::getAvailableDrivers()) && function_exists('mb_strlen') ? 'ok' : 'missing';"`,
  { encoding: 'utf8' }
).trim();
if (check !== 'ok') {
  throw new Error('The bundled PHP runtime cannot use SQLite. Check the PHP files copied to src-tauri/bundle/php.');
}
console.log('Bundle ready: src-tauri/bundle (PHP runtime checked, SQLite available).');
