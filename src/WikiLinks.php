<?php
declare(strict_types=1);

namespace Graphin;

/**
 * Wiki links in a tile's title or notes: [[Target tile | label | text to show]]. The label and the text to show are
 * optional. Labels separated by commas, [[Target | supports, leads to]], make one link (arrow) for each, so the two tiles are
 * joined by both. A plain [[Target tile]] only links in the text, with no arrow.
 *
 * The arrows made from wiki links are marked (edges.wikilink = 1), and the text decides them: when a label is edited out, or the
 * whole link is, its arrow is removed. An arrow drawn by hand is never touched, and an arrow that is edited by hand stops being
 * managed by the text (see EdgeController::update).
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
     * The labels written between the first and the second "|", separated by commas: "supports, leads to" is SUPPORTS and
     * LEADS_TO. An empty one (a comma with nothing after it yet) is left out.
     *
     * @return list<string>
     */
    public static function labels(string $text): array
    {
        $labels = [];
        foreach (explode(',', $text) as $part) {
            $label = self::relationship($part);
            if ($label !== null) {
                $labels[$label] = true;
            }
        }
        return array_keys($labels);
    }

    /**
     * Brings the arrows of a tile in line with the wiki links in its text. It makes the arrows the text asks for that are
     * missing, and removes the arrows that earlier wiki links made and the text no longer asks for.
     *
     * An arrow is asked for by a wiki link that has a label, whose target is another tile of the same network (found by its
     * title, ignoring capitals). Two tiles already joined by that label, in either direction, are not joined again.
     *
     * @return array{created: list<array<string, mixed>>, removed: list<string>} the arrows made, and the ids of the arrows removed
     */
    public static function sync(Database $db, string $networkId, string $nodeId, ?string $title, ?string $commentary): array
    {
        $nothing = ['created' => [], 'removed' => []];
        $source = $db->fetchOne('SELECT type FROM nodes WHERE id = ?', [$nodeId]);
        // Frames and text labels are not tiles, so they do not make links.
        if ($source === null || in_array($source['type'], ['shape', 'text'], true)) {
            return $nothing;
        }

        // What the text asks for: each target tile with each label.
        $wanted = [];
        foreach (array_merge(self::parse($title), self::parse($commentary)) as $link) {
            $labels = self::labels($link['relationship']);
            if ($labels === []) {
                continue;
            }
            $target = $db->fetchOne(
                "SELECT id FROM nodes WHERE network_id = ? AND type NOT IN ('shape', 'text') AND id <> ? AND LOWER(title) = LOWER(?) LIMIT 1",
                [$networkId, $nodeId, $link['target']]
            );
            if ($target === null) {
                continue;
            }
            foreach ($labels as $label) {
                $wanted[$target['id'] . '|' . $label] = [$target['id'], $label];
            }
        }

        // Arrows an earlier wiki link made that the text no longer asks for are removed.
        $removed = [];
        $kept = [];
        foreach ($db->fetchAll('SELECT id, target_id, relationship FROM edges WHERE source_id = ? AND wikilink = 1', [$nodeId]) as $edge) {
            $key = $edge['target_id'] . '|' . $edge['relationship'];
            if (isset($wanted[$key])) {
                $kept[$key] = true;
                continue;
            }
            $db->execute('DELETE FROM edges WHERE id = ?', [$edge['id']]);
            $removed[] = (string) $edge['id'];
        }

        // Arrows the text asks for that do not exist yet are made.
        $created = [];
        foreach ($wanted as $key => [$targetId, $label]) {
            if (isset($kept[$key])) {
                continue;
            }
            // The direction does not make a link different: "A supports B" and "B supports A" are the same relationship.
            $existing = $db->fetchOne(
                'SELECT id FROM edges WHERE ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)) AND relationship = ?',
                [$nodeId, $targetId, $targetId, $nodeId, $label]
            );
            if ($existing !== null) {
                continue;
            }
            $id = Database::uuid();
            $db->execute(
                'INSERT INTO edges (id, network_id, source_id, target_id, relationship, is_bidirectional, wikilink) VALUES (?, ?, ?, ?, ?, 0, 1)',
                [$id, $networkId, $nodeId, $targetId, $label]
            );
            $created[] = [
                'id' => $id,
                'source_id' => $nodeId,
                'target_id' => $targetId,
                'relationship' => $label,
                'is_bidirectional' => false,
                'style' => null,
                'tags' => [],
            ];
        }
        return ['created' => $created, 'removed' => $removed];
    }
}
