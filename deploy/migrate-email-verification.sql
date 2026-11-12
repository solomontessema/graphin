-- One-time migration for existing Graphin databases: adds email verification and password reset.
--
-- Run it ONCE on the live database, in phpMyAdmin, BEFORE uploading code that uses it (deploy.ps1 does not run SQL).
-- Every account that already exists is marked as verified, so existing people can still log in.
-- Safe to run again: columns and tables are added only if missing, and only unverified accounts are updated.

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `email_verified_at` datetime(3) DEFAULT NULL;

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

UPDATE `users` SET `email_verified_at` = `created_at` WHERE `email_verified_at` IS NULL;
