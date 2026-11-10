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
-- Shapes: a node of type 'shape' is a frame drawn on the canvas. Its size is stored here (width and
-- height). Only shapes use these columns; they stay NULL for other nodes.
-- ---------------------------------------------------------------------------
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS width DOUBLE NULL;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS height DOUBLE NULL;

-- Shape of a tile or a canvas shape: rect, rounded, pill, ellipse, circle, polygon and so on.
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS shape VARCHAR(10) NULL;

-- Appearance (JSON): colours and widths of nodes, shapes, and links.
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS style TEXT NULL;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS style TEXT NULL;

-- Time and place of a node: event_time is a partial date (1945, 1945-08, 1945-08-06), latitude and
-- longitude are decimal degrees, and country is free text. Used later for timelines and maps.
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS event_time VARCHAR(16) NULL;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS latitude DOUBLE NULL;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS longitude DOUBLE NULL;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL;

-- References of a node: any number of extra pages on its topic, as a JSON list of {url, title?}.
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS refs MEDIUMTEXT NULL;

-- Tags (codes) on nodes and edges, as a JSON list of lower-case labels, and the colour of each tag in a network.
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS tags TEXT NULL;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS tags TEXT NULL;
ALTER TABLE networks ADD COLUMN IF NOT EXISTS tag_colors TEXT NULL;
-- The picture shown on the network's tile on the home page: a link to an image, or none for the default.
ALTER TABLE networks ADD COLUMN IF NOT EXISTS cover_url TEXT NULL;
-- The background colour of the network's tile on the home page, such as #1d4ed8, or none.
ALTER TABLE networks ADD COLUMN IF NOT EXISTS tile_color VARCHAR(7) NULL;

-- Accounts. The email address is the username (always lower-case). Only a password hash is stored.
-- Each network belongs to one user.
CREATE TABLE IF NOT EXISTS users (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uniq_users_email (email)
) ENGINE=InnoDB;
ALTER TABLE networks ADD COLUMN IF NOT EXISTS user_id CHAR(36) NULL;
ALTER TABLE networks ADD KEY IF NOT EXISTS idx_networks_user (user_id);
