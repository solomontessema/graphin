<?php
declare(strict_types=1);

namespace Graphin\Controllers;

use Graphin\ApiException;
use Graphin\Style;
use Graphin\Database;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Edges are relationships between two nodes in the same network.
 * POST /api/networks/{id}/edges, DELETE /api/edges/{id}
 */
final class EdgeController extends BaseController
{
    /** POST /api/networks/{id}/edges {source_id, target_id, relationship, is_bidirectional?} */
    public function store(Request $request, Response $response, array $args): Response
    {
        $this->findNetwork($args['id']);
        $data = $this->body($request);

        $sourceId = $this->requiredString($data, 'source_id', 36);
        $targetId = $this->requiredString($data, 'target_id', 36);
        if ($sourceId === $targetId) {
            throw new ApiException(422, 'A node cannot link to itself.');
        }
        $this->assertInNetwork($sourceId, $args['id']);
        $this->assertInNetwork($targetId, $args['id']);

        $relationship = $this->relationship($data);
        $bidirectional = !empty($data['is_bidirectional']) ? 1 : 0;

        $this->assertNotLinkedBy($sourceId, $targetId, $relationship, null);

        $id = Database::uuid();
        $this->db->execute(
            'INSERT INTO edges (id, network_id, source_id, target_id, relationship, is_bidirectional, style, tags)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, $args['id'], $sourceId, $targetId, $relationship, $bidirectional, Style::clean($data['style'] ?? null, Style::EDGE_KEYS), $this->optionalTags($data)]
        );
        $row = $this->db->fetchOne(
            'SELECT id, source_id, target_id, relationship, is_bidirectional, style, tags FROM edges WHERE id = ?',
            [$id]
        );
        return $this->json($response, [
            'id' => $row['id'],
            'source_id' => $row['source_id'],
            'target_id' => $row['target_id'],
            'relationship' => $row['relationship'],
            'is_bidirectional' => (bool) $row['is_bidirectional'],
            'style' => Style::decode($row['style'] ?? null),
            'tags' => self::decodeTags($row['tags'] ?? null),
        ], 201);
    }

    /**
     * PUT /api/edges/{id}: any of
     *   style             the line colour and weight; null resets the line
     *   relationship      the label, as for a new link
     *   is_bidirectional  arrows at both ends
     *   reverse           true swaps the two ends, so the arrow points the other way
     *   tags              the link's tags (codes); null or an empty list clears them
     */
    public function update(Request $request, Response $response, array $args): Response
    {
        $row = $this->db->fetchOne('SELECT * FROM edges WHERE id = ?', [$args['id']]);
        if ($row === null) {
            throw new ApiException(404, 'Edge not found.');
        }
        $this->findNetwork($row['network_id']);
        $data = $this->body($request);
        $style = array_key_exists('style', $data)
            ? Style::clean($data['style'], Style::EDGE_KEYS)
            : $row['style'];

        $tags = array_key_exists('tags', $data) ? $this->optionalTags($data) : $row['tags'];

        $source = $row['source_id'];
        $target = $row['target_id'];
        if (!empty($data['reverse'])) {
            [$source, $target] = [$target, $source];
        }
        $relationship = $row['relationship'];
        if (array_key_exists('relationship', $data)) {
            $relationship = $this->relationship($data);
        }
        $bidirectional = array_key_exists('is_bidirectional', $data)
            ? (!empty($data['is_bidirectional']) ? 1 : 0)
            : (int) $row['is_bidirectional'];

        // Only a changed relationship can collide with another link between the same two items.
        if ($relationship !== $row['relationship']) {
            $this->assertNotLinkedBy($source, $target, $relationship, $args['id']);
        }

        $this->db->execute(
            'UPDATE edges SET style = ?, source_id = ?, target_id = ?, relationship = ?, is_bidirectional = ?, tags = ?
             WHERE id = ?',
            [$style, $source, $target, $relationship, $bidirectional, $tags, $args['id']]
        );

        $row = $this->db->fetchOne(
            'SELECT id, source_id, target_id, relationship, is_bidirectional, style, tags FROM edges WHERE id = ?',
            [$args['id']]
        );
        return $this->json($response, [
            'id' => $row['id'],
            'source_id' => $row['source_id'],
            'target_id' => $row['target_id'],
            'relationship' => $row['relationship'],
            'is_bidirectional' => (bool) $row['is_bidirectional'],
            'style' => Style::decode($row['style'] ?? null),
            'tags' => self::decodeTags($row['tags'] ?? null),
        ]);
    }

    /** DELETE /api/edges/{id} */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $row = $this->db->fetchOne('SELECT network_id FROM edges WHERE id = ?', [$args['id']]);
        if ($row === null) {
            throw new ApiException(404, 'Edge not found.');
        }
        $this->findNetwork($row['network_id']);
        $this->db->execute('DELETE FROM edges WHERE id = ?', [$args['id']]);
        return $response->withStatus(204);
    }

    /**
     * Relationship labels are upper-case words such as SUPPORTS or USES. Spaces and hyphens
     * become underscores, so "supports" and "Supports" are the same label.
     *
     * @param array<string, mixed> $data
     */
    /**
     * Two items may be joined by any number of links, as long as each one has a different relationship. The direction
     * does not make a link different: "A supports B" and "B supports A" are the same relationship.
     */
    private function assertNotLinkedBy(string $a, string $b, string $relationship, ?string $exceptId): void
    {
        $sql = 'SELECT id FROM edges WHERE ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)) AND relationship = ?';
        $params = [$a, $b, $b, $a, $relationship];
        if ($exceptId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        if ($this->db->fetchOne($sql, $params) !== null) {
            $name = strtolower(str_replace('_', ' ', $relationship));
            throw new ApiException(409, "These two items are already linked by \"$name\". Choose a different relationship.");
        }
    }

    private function relationship(array $data): string
    {
        $raw = isset($data['relationship']) ? (string) $data['relationship'] : 'RELATED';
        $label = strtoupper(str_replace([' ', '-'], '_', trim($raw)));
        if ($label === '') {
            $label = 'RELATED';
        }
        if (!preg_match(self::RELATIONSHIP_PATTERN, $label)) {
            throw new ApiException(422, 'Relationship must be letters, spaces, or underscores (50 characters at most).');
        }
        return $label;
    }

    private function assertInNetwork(string $nodeId, string $networkId): void
    {
        $node = $this->findNode($nodeId);
        if ($node['network_id'] !== $networkId) {
            throw new ApiException(422, 'Both nodes must belong to this network.');
        }
    }
}
