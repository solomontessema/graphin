-- One-time migration for existing Graphin databases: marks the arrows that are made from [[wiki links]] in a tile's text.
--
-- Run it ONCE on the live database, in phpMyAdmin, BEFORE uploading code that uses it (deploy.ps1 does not run SQL).
-- Existing arrows stay as they are (0 = drawn by hand). Safe to run again: the column is added only if missing.

ALTER TABLE `edges` ADD COLUMN IF NOT EXISTS `wikilink` tinyint(1) NOT NULL DEFAULT 0;
