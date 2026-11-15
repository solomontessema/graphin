<?php
declare(strict_types=1);

namespace Graphin;

/**
 * Wiki links in a tile's title or notes: [[Target tile | relationship | text to show]]. The relationship and the text to
 * show are optional. A link that names a relationship makes a link (arrow) from this tile to the target tile, as if it
 * had been drawn by hand. A plain [[Target tile]] only links in the text, with no arrow.
 *
 * The arrow is made once. It is not removed when the wiki link is later edited out of the text, because it can be changed
 * or deleted on its own, like any other link.
 */
final class WikiLinks
{
    private const PATTERN = '/\[\[([^\[\]|]+?)\s*(?:\|\s*([^\[\]|]*?)\s*)?(?:\|\s*([^\[\]]*?)\s*)?\]\]/u';

    /**
     * Every wiki link in the text.
     *
     * @return list<array{target: string, relationship: string, display: string}>
     */
    public static function parse(?string $text): array
    {
        if ($text === null || $text === '' || !preg_match_all(self::PATTERN, $text, $matches, PREG_SET_ORDER)) {
            return [];
        }
        $links = [];
        foreach ($matches as $match) {
            $links[] = [
                'target' => trim($match[1]),
                'relationship' => trim($match[2] ?? ''),
                'display' => trim($match[3] ?? ''),
            ];
        }
        return $links;
    }

    /** "leads to" becomes LEADS_TO. Anything that is not a letter or an underscore is dropped. Null when nothing is left. */
    public static function relationship(string $text): ?string
    {
        $label = strtoupper(str_replace([' ', '-'], '_', trim($text)));
        $label = preg_replace('/[^A-Z_]/', '', $label) ?? '';
        $label = trim((string) preg_replace('/_+/', '_', $label), '_');
        $label = substr($label, 0, 50);
        return $label === '' ? null : $label;
    }

    /**
     * Makes the links that the wiki links of a tile ask for. A link is made only when its relationship is written, the
     * target is another tile of the same network (found by its title, ignoring capitals), and those two tiles are not
     * already linked by that relationship. Returns the links it made.
     *
     * @return list<array<string, mixed>>
     */
    public static function sync(Database $db, string $networkId, string $nodeId, ?string $title, ?string $commentary): array
    {
        $source = $db->fetchOne('SELECT type FROM nodes WHERE id = ?', [$nodeId]);
        // Frames and text labels are not tiles, so they do not make links.
        if ($source === null || in_array($source['type'], ['shape', 'text'], true)) {
            return [];
        }

        $made = [];
        $done = [];
        foreach (array_merge(self::parse($title), self::parse($commentary)) as $link) {
            $relationship = self::relationship($link['relationship']);
            if ($relationship === null) {
                continue;
            }
            $target = $db->fetchOne(
                "SELECT id FROM nodes WHERE network_id = ? AND type NOT IN ('shape', 'text') AND id <> ? AND LOWER(title) = LOWER(?) LIMIT 1",
                [$networkId, $nodeId, $link['target']]
            );
            if ($target === null) {
                continue;
            }
            $key = $target['id'] . '|' . $relationship;
            if (isset($done[$key])) {
                continue;
            }
            $done[$key] = true;
            // The direction does not make a link different: "A supports B" and "B supports A" are the same relationship.
            $existing = $db->fetchOne(
                'SELECT id FROM edges WHERE ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)) AND relationship = ?',
                [$nodeId, $target['id'], $target['id'], $nodeId, $relationship]
            );
            if ($existing !== null) {
                continue;
            }
            $id = Database::uuid();
            $db->execute(
                'INSERT INTO edges (id, network_id, source_id, target_id, relationship, is_bidirectional) VALUES (?, ?, ?, ?, ?, 0)',
                [$id, $networkId, $nodeId, $target['id'], $relationship]
            );
            $made[] = [
                'id' => $id,
                'source_id' => $nodeId,
                'target_id' => $target['id'],
                'relationship' => $relationship,
                'is_bidirectional' => false,
                'style' => null,
                'tags' => [],
            ];
        }
        return $made;
    }
}
