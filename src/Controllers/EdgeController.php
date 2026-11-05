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
        if ($relationship === 'BELONGS_TO') {
            $this->assertMembership($sourceId, $targetId);
            // Membership is drawn as containment, not as an arrow.
            $bidirectional = 0;
        }

        $exists = $this->db->fetchOne(
            'SELECT id FROM edges WHERE source_id = ? AND target_id = ? AND relationship = ?',
            [$sourceId, $targetId, $relationship]
        );
        if ($exists !== null) {
            throw new ApiException(409, 'These two nodes already have that relationship.');
        }

        $id = Database::uuid();
        $this->db->execute(
            'INSERT INTO edges (id, network_id, source_id, target_id, relationship, is_bidirectional, style)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$id, $args['id'], $sourceId, $targetId, $relationship, $bidirectional, Style::clean($data['style'] ?? null, Style::EDGE_KEYS)]
        );
        $row = $this->db->fetchOne(
            'SELECT id, source_id, target_id, relationship, is_bidirectional, style FROM edges WHERE id = ?',
            [$id]
        );
        return $this->json($response, [
            'id' => $row['id'],
            'source_id' => $row['source_id'],
            'target_id' => $row['target_id'],
            'relationship' => $row['relationship'],
            'is_bidirectional' => (bool) $row['is_bidirectional'],
            'style' => Style::decode($row['style'] ?? null),
        ], 201);
    }

    /** PUT /api/edges/{id} {style}: the line colour and weight. A style of null resets the line. */
    public function update(Request $request, Response $response, array $args): Response
    {
        $row = $this->db->fetchOne('SELECT * FROM edges WHERE id = ?', [$args['id']]);
        if ($row === null) {
            throw new ApiException(404, 'Edge not found.');
        }
        $data = $this->body($request);
        $style = array_key_exists('style', $data)
            ? Style::clean($data['style'], Style::EDGE_KEYS)
            : $row['style'];
        $this->db->execute('UPDATE edges SET style = ? WHERE id = ?', [$style, $args['id']]);

        $row = $this->db->fetchOne(
            'SELECT id, source_id, target_id, relationship, is_bidirectional, style FROM edges WHERE id = ?',
            [$args['id']]
        );
        return $this->json($response, [
            'id' => $row['id'],
            'source_id' => $row['source_id'],
            'target_id' => $row['target_id'],
            'relationship' => $row['relationship'],
            'is_bidirectional' => (bool) $row['is_bidirectional'],
            'style' => Style::decode($row['style'] ?? null),
        ]);
    }

    /** DELETE /api/edges/{id} */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $affected = $this->db->execute('DELETE FROM edges WHERE id = ?', [$args['id']]);
        if ($affected === 0) {
            throw new ApiException(404, 'Edge not found.');
        }
        return $response->withStatus(204);
    }

    /**
     * Relationship labels are upper-case words such as SUPPORTS or USES. Spaces and hyphens
     * become underscores, so "supports" and "Supports" are the same label.
     *
     * @param array<string, mixed> $data
     */
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

    /**
     * BELONGS_TO puts a node inside a container. The source is the member and the target is the container.
     * A node can belong to several containers at once (overlapping frames), and a container can belong to
     * another container (nesting). The only rule is that nothing may end up containing itself.
     */
    private function assertMembership(string $memberId, string $groupId): void
    {
        $group = $this->findNode($groupId);
        if ($group['type'] !== 'group') {
            throw new ApiException(422, 'A node can only belong to a group.');
        }
        if ($memberId === $groupId) {
            throw new ApiException(422, 'A group cannot contain itself.');
        }
        // Walk up from the container: if the member is reached, adding this link would close a loop.
        $frontier = [$groupId];
        $seen = [$groupId => true];
        while ($frontier !== []) {
            $next = [];
            foreach ($frontier as $id) {
                $rows = $this->db->fetchAll(
                    "SELECT target_id FROM edges WHERE source_id = ? AND relationship = 'BELONGS_TO'",
                    [$id]
                );
                foreach ($rows as $row) {
                    if ($row['target_id'] === $memberId) {
                        throw new ApiException(422, 'That would put a group inside itself.');
                    }
                    if (!isset($seen[$row['target_id']])) {
                        $seen[$row['target_id']] = true;
                        $next[] = $row['target_id'];
                    }
                }
            }
            $frontier = $next;
        }
    }

    private function assertInNetwork(string $nodeId, string $networkId): void
    {
        $node = $this->findNode($nodeId);
        if ($node['network_id'] !== $networkId) {
            throw new ApiException(422, 'Both nodes must belong to this network.');
        }
    }
}
