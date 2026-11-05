<?php
declare(strict_types=1);

namespace Graphin;

use PDO;
use Throwable;

/**
 * Thin PDO wrapper: one connection per request, prepared statements, and a transaction helper
 * that rolls back on any exception. Works with MariaDB/MySQL (web) and SQLite (desktop).
 */
class Database
{
    private PDO $pdo;
    private string $driver;

    /**
     * @param array{driver?:string,host?:string,port?:string,name?:string,user?:string,pass?:string,charset?:string,path?:string} $config
     *        driver "mysql" (default) uses host/port/name/user/pass/charset.
     *        driver "sqlite" uses path, the database file.
     */
    public function __construct(array $config)
    {
        $this->driver = $config['driver'] ?? 'mysql';
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            // Real server-side prepares: values are never interpolated into SQL.
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        if ($this->driver === 'sqlite') {
            $this->pdo = new PDO('sqlite:' . $config['path'], null, null, $options);
            // SQLite leaves foreign keys off unless asked. Cascading deletes depend on this.
            $this->pdo->exec('PRAGMA foreign_keys = ON');
            $this->pdo->exec('PRAGMA busy_timeout = 5000');
            // WAL keeps reads responsive while a save is being written.
            $this->pdo->exec('PRAGMA journal_mode = WAL');
            return;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $config['host'],
            $config['port'],
            $config['name'],
            $config['charset']
        );
        $this->pdo = new PDO($dsn, $config['user'], $config['pass'], $options);
    }

    public function driver(): string
    {
        return $this->driver;
    }

    /**
     * Creates any missing tables. The schema files use IF NOT EXISTS, so running this again is safe.
     */
    public function applySchema(string $file): void
    {
        $this->pdo->exec((string) file_get_contents($file));
    }

    /**
     * Adds a column to an existing table if it is missing. Table and column names come from the code,
     * never from users.
     */
    public function ensureColumn(string $table, string $column, string $definition): void
    {
        if ($this->driver === 'sqlite') {
            $names = array_column($this->fetchAll("PRAGMA table_info($table)"), 'name');
        } else {
            $names = array_column(
                $this->fetchAll(
                    'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
                    [$table]
                ),
                'name'
            );
        }
        if (!in_array($column, $names, true)) {
            $this->pdo->exec("ALTER TABLE $table ADD COLUMN $column $definition");
        }
    }

    /** @return array<int, array<string, mixed>> */
    public function fetchAll(string $sql, array $params = []): array
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public function fetchOne(string $sql, array $params = []): ?array
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    /** Runs a write statement and returns the number of affected rows. */
    public function execute(string $sql, array $params = []): int
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        return $statement->rowCount();
    }

    /**
     * Runs $work inside a transaction. Any exception rolls back and is rethrown.
     *
     * @return mixed whatever $work returns
     */
    public function transaction(callable $work)
    {
        $this->pdo->beginTransaction();
        try {
            $result = $work($this);
            $this->pdo->commit();
            return $result;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /** Generates an RFC 4122 version 4 UUID. */
    public static function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
