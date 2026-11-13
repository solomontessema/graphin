-- Graphin database setup for a hosted MariaDB / MySQL database (for example IONOS).
--
-- Import it into the EMPTY database you created for Graphin: in phpMyAdmin select that database, open the
-- Import tab and choose this file. It does not create or select a database, so it cannot touch another one.
-- Do not import it into a database that already has tables of another app: Graphin uses the table names
-- users, networks, nodes and edges.
--
-- Safe to import more than once: a table is created only if it does not exist yet.
-- Works on MariaDB 10.2+ and MySQL 5.7+ / 8. It is the same structure as schema.sql, written out in full.

CREATE TABLE IF NOT EXISTS `users` (
  `id` char(36) NOT NULL,
  `email` varchar(254) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `email_verified_at` datetime(3) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `account_tokens` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `purpose` varchar(10) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `used_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_tokens_hash` (`token_hash`),
  KEY `idx_account_tokens_user` (`user_id`, `purpose`),
  CONSTRAINT `fk_account_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `networks` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  `tag_colors` text DEFAULT NULL,
  `cover_url` text DEFAULT NULL,
  `tile_color` varchar(7) DEFAULT NULL,
  `user_id` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_networks_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `nodes` (
  `id` char(36) NOT NULL,
  `network_id` char(36) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'webpage',
  `url` varchar(2048) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `favicon_url` varchar(2048) DEFAULT NULL,
  `thumbnail_url` varchar(2048) DEFAULT NULL,
  `commentary` text DEFAULT NULL,
  `x` double NOT NULL DEFAULT 0,
  `y` double NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  `width` double DEFAULT NULL,
  `height` double DEFAULT NULL,
  `shape` varchar(10) DEFAULT NULL,
  `style` text DEFAULT NULL,
  `event_time` varchar(16) DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `refs` mediumtext DEFAULT NULL,
  `tags` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_nodes_network` (`network_id`),
  CONSTRAINT `fk_nodes_network` FOREIGN KEY (`network_id`) REFERENCES `networks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `edges` (
  `id` char(36) NOT NULL,
  `network_id` char(36) NOT NULL,
  `source_id` char(36) NOT NULL,
  `target_id` char(36) NOT NULL,
  `relationship` varchar(50) NOT NULL DEFAULT 'RELATED',
  `is_bidirectional` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `style` text DEFAULT NULL,
  `tags` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_edges_pair` (`source_id`,`target_id`,`relationship`),
  KEY `idx_edges_network` (`network_id`),
  KEY `fk_edges_target` (`target_id`),
  CONSTRAINT `fk_edges_network` FOREIGN KEY (`network_id`) REFERENCES `networks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_edges_source` FOREIGN KEY (`source_id`) REFERENCES `nodes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_edges_target` FOREIGN KEY (`target_id`) REFERENCES `nodes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
