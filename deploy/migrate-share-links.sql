-- One-time migration for existing Graphin databases: share links, so that anyone with a link can read a network.
--
-- Run it ONCE on the live database, in phpMyAdmin, BEFORE sharing is used (deploy.ps1 does not run SQL). Until it has run, the
-- Share button reports an error and nothing else is affected. Safe to run again: the column and the key are added only if missing.

ALTER TABLE `networks` ADD COLUMN IF NOT EXISTS `share_token` char(48) DEFAULT NULL;
ALTER TABLE `networks` ADD UNIQUE KEY IF NOT EXISTS `uq_networks_share` (`share_token`);
