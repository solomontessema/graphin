-- Graphin schema for the desktop version (SQLite). Same tables and columns as schema.sql (MariaDB),
-- written for SQLite. Everything uses IF NOT EXISTS, so applying it again is safe.
-- The desktop app applies it automatically on first start; see src/Database.php.

-- Networks: one research map each.
CREATE TABLE IF NOT EXISTS networks (
    id         TEXT NOT NULL PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

-- Nodes: a saved link (or a note or a group). x and y are the canvas position. width, height, and
-- shape are used only by groups.
CREATE TABLE IF NOT EXISTS nodes (
    id            TEXT NOT NULL PRIMARY KEY,
    network_id    TEXT NOT NULL REFERENCES networks (id) ON DELETE CASCADE,
    type          TEXT NOT NULL DEFAULT 'webpage',
    url           TEXT NULL,
    title         TEXT NOT NULL,
    favicon_url   TEXT NULL,
    thumbnail_url TEXT NULL,
    commentary    TEXT NULL,
    x             REAL NOT NULL DEFAULT 0,
    y             REAL NOT NULL DEFAULT 0,
    width         REAL NULL,
    height        REAL NULL,
    shape         TEXT NULL,
    style         TEXT NULL,
    event_time    TEXT NULL,
    latitude      REAL NULL,
    longitude     REAL NULL,
    country       TEXT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_nodes_network ON nodes (network_id);

-- Edges: a relationship between two nodes. is_bidirectional = 0 draws an arrow from source to target.
-- BELONGS_TO links a node to a group (the source is the member, the target is the group).
CREATE TABLE IF NOT EXISTS edges (
    id               TEXT NOT NULL PRIMARY KEY,
    network_id       TEXT NOT NULL REFERENCES networks (id) ON DELETE CASCADE,
    source_id        TEXT NOT NULL REFERENCES nodes (id) ON DELETE CASCADE,
    target_id        TEXT NOT NULL REFERENCES nodes (id) ON DELETE CASCADE,
    relationship     TEXT NOT NULL DEFAULT 'RELATED',
    is_bidirectional INTEGER NOT NULL DEFAULT 0,
    style            TEXT NULL,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    UNIQUE (source_id, target_id, relationship)
);
CREATE INDEX IF NOT EXISTS idx_edges_network ON edges (network_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges (source_id);

-- MariaDB updates updated_at by itself. SQLite needs a trigger to do the same.
CREATE TRIGGER IF NOT EXISTS networks_touch AFTER UPDATE ON networks FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE networks SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS nodes_touch AFTER UPDATE ON nodes FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE nodes SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = NEW.id;
END;
