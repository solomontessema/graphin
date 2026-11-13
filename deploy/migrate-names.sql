-- One-time migration for existing Graphin databases: first and last name on accounts.
--
-- Run it ONCE on the live database, in phpMyAdmin, BEFORE uploading code that uses it (deploy.ps1 does not run SQL).
-- Existing accounts keep NULL names. Safe to run again: the columns are added only if missing.

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `first_name` varchar(100) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `last_name` varchar(100) DEFAULT NULL;
