-- Graphin schema: networks of linked nodes. Each node is a saved link with an
-- optional commentary (highlighted text and your own notes). No page content is stored.
-- Requires MariaDB 10.2+ or MySQL 5.7+.
-- Load with:  C:\xampp\mysql\bin\mysql.exe -u root -e "source C:/xampp/htdocs/Graphin/schema.sql"
-- Safe to re-run: tables are created only if missing.

CREATE DATABASE IF NOT EXISTS graphin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE graphin;

-- ---------------------------------------------------------------------------
-- Networks: one research map each.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS networks (
    id         CHAR(36)     NOT NULL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Nodes: a saved link. x and y hold the canvas position so the layout survives
-- a reload. commentary holds highlighted text and notes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nodes (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    network_id    CHAR(36)     NOT NULL,
    type          VARCHAR(20)  NOT NULL DEFAULT 'webpage',
    url           VARCHAR(2048) NULL,
    title         VARCHAR(255) NOT NULL,
    favicon_url   VARCHAR(2048) NULL,
    thumbnail_url VARCHAR(2048) NULL,
    commentary    TEXT         NULL,
    x             DOUBLE       NOT NULL DEFAULT 0,
    y             DOUBLE       NOT NULL DEFAULT 0,
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_nodes_network (network_id),
    CONSTRAINT fk_nodes_network FOREIGN KEY (network_id) REFERENCES networks (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Edges: a relationship between two nodes. is_bidirectional = 0 draws an arrow
-- from source to target; 1 draws no arrow. One relationship label per pair per type.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edges (
    id               CHAR(36)    NOT NULL PRIMARY KEY,
    network_id       CHAR(36)    NOT NULL,
    source_id        CHAR(36)    NOT NULL,
    target_id        CHAR(36)    NOT NULL,
    relationship     VARCHAR(50) NOT NULL DEFAULT 'RELATED',
    is_bidirectional TINYINT(1)  NOT NULL DEFAULT 0,
    created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_edges_pair (source_id, target_id, relationship),
    KEY idx_edges_network (network_id),
    CONSTRAINT fk_edges_network FOREIGN KEY (network_id) REFERENCES networks (id) ON DELETE CASCADE,
    CONSTRAINT fk_edges_source FOREIGN KEY (source_id) REFERENCES nodes (id) ON DELETE CASCADE,
    CONSTRAINT fk_edges_target FOREIGN KEY (target_id) REFERENCES nodes (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Groups: a node of type 'group' is a box that holds its members. Its size is stored
-- here (width and height). Only groups use these columns; they stay NULL for other nodes.
-- ---------------------------------------------------------------------------
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS width DOUBLE NULL;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS height DOUBLE NULL;

-- Group shape: 'rect' (default) or 'circle'. Only groups use it.
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS shape VARCHAR(10) NULL;

-- Appearance (JSON): colours and widths of nodes, groups, and links.
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS style TEXT NULL;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS style TEXT NULL;

-- Time and place of a node: event_time is a partial date (1945, 1945-08, 1945-08-06), latitude and
-- longitude are decimal degrees, and country is free text. Used later for timelines and maps.
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS event_time VARCHAR(16) NULL;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS latitude DOUBLE NULL;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS longitude DOUBLE NULL;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL;
