<?php
declare(strict_types=1);

namespace Graphin\Controllers;

use Graphin\ApiException;
use Graphin\Database;
use Graphin\Style;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Networks: GET /api/networks, POST /api/networks, PUT|DELETE /api/networks/{id},
 * GET /api/networks/{id}/graph, PUT /api/networks/{id}/positions
 */
final class NetworkController extends BaseController
{
    /** GET /api/networks : most recently changed first, with node counts. */
    public function index(Request $request, Response $response): Response
    {
        $networks = $this->db->fetchAll(
            'SELECT n.id, n.name, n.created_at, n.updated_at,
                    (SELECT COUNT(*) FROM nodes d WHERE d.network_id = n.id) AS node_count
             FROM networks n
             ORDER BY n.updated_at DESC'
        );
        return $this->json($response, array_map([$this, 'summary'], $networks));
    }

    /** POST /api/networks {name} */
    public function store(Request $request, Response $response): Response
    {
        $data = $this->body($request);
        $name = $this->requiredString($data, 'name', self::TITLE_MAX);
        $id = Database::uuid();
        $this->db->execute('INSERT INTO networks (id, name) VALUES (?, ?)', [$id, $name]);
        return $this->json($response, $this->summary($this->findNetwork($id) + ['node_count' => 0]), 201);
    }

    /** PUT /api/networks/{id} {name} */
    public function update(Request $request, Response $response, array $args): Response
    {
        $this->findNetwork($args['id']);
        $name = $this->requiredString($this->body($request), 'name', self::TITLE_MAX);
        $this->db->execute('UPDATE networks SET name = ? WHERE id = ?', [$name, $args['id']]);
        return $this->json($response, $this->summary($this->findNetwork($args['id']) + ['node_count' => 0]));
    }

    /** DELETE /api/networks/{id} : removes its nodes and edges too. */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $this->findNetwork($args['id']);
        $this->db->execute('DELETE FROM networks WHERE id = ?', [$args['id']]);
        return $response->withStatus(204);
    }

    /** GET /api/networks/{id}/graph : the whole canvas in one call. */
    public function graph(Request $request, Response $response, array $args): Response
    {
        $network = $this->findNetwork($args['id']);
        $nodes = $this->db->fetchAll(
            'SELECT id, type, url, title, favicon_url, thumbnail_url, commentary, x, y, width, height, shape, style,
                    event_time, latitude, longitude, country, created_at, updated_at
             FROM nodes WHERE network_id = ? ORDER BY created_at',
            [$args['id']]
        );
        $edges = $this->db->fetchAll(
            'SELECT id, source_id, target_id, relationship, is_bidirectional, style
             FROM edges WHERE network_id = ? ORDER BY created_at',
            [$args['id']]
        );
        return $this->json($response, [
            'network' => $this->summary($network + ['node_count' => count($nodes)]),
            'nodes' => array_map([$this, 'nodeOut'], $nodes),
            'edges' => array_map([$this, 'edgeOut'], $edges),
        ]);
    }

    /**
     * PUT /api/networks/{id}/positions [{id, x, y}, ...]
     * Saves the layout after a drag. Ids outside this network are ignored.
     */
    public function positions(Request $request, Response $response, array $args): Response
    {
        $this->findNetwork($args['id']);
        $items = $this->body($request);
        $this->db->transaction(function (Database $db) use ($items, $args): void {
            foreach ($items as $item) {
                if (!is_array($item) || !isset($item['id'])) {
                    continue;
                }
                // Width and height are sent only for groups, and are left as they are otherwise.
                $db->execute(
                    'UPDATE nodes
                     SET x = ?, y = ?, width = COALESCE(?, width), height = COALESCE(?, height)
                     WHERE id = ? AND network_id = ?',
                    [
                        $this->number($item, 'x'),
                        $this->number($item, 'y'),
                        isset($item['width']) ? $this->number($item, 'width') : null,
                        isset($item['height']) ? $this->number($item, 'height') : null,
                        (string) $item['id'],
                        $args['id'],
                    ]
                );
            }
        });
        return $response->withStatus(204);
    }

    /** @return array<string, mixed> */
    private function summary(array $row): array
    {
        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'node_count' => (int) ($row['node_count'] ?? 0),
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function nodeOut(array $row): array
    {
        return [
            'id' => $row['id'],
            'type' => $row['type'],
            'url' => $row['url'],
            'title' => $row['title'],
            'favicon_url' => $row['favicon_url'],
            'thumbnail_url' => $row['thumbnail_url'],
            'commentary' => $row['commentary'],
            'x' => (float) $row['x'],
            'y' => (float) $row['y'],
            'width' => $row['width'] === null ? null : (float) $row['width'],
            'height' => $row['height'] === null ? null : (float) $row['height'],
            'shape' => $row['type'] === 'group' ? ($row['shape'] ?? 'rect') : null,
            'style' => Style::decode($row['style'] ?? null),
            'time' => $row['event_time'] ?? null,
            'latitude' => $row['latitude'] === null ? null : (float) $row['latitude'],
            'longitude' => $row['longitude'] === null ? null : (float) $row['longitude'],
            'country' => $row['country'] ?? null,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function edgeOut(array $row): array
    {
        return [
            'id' => $row['id'],
            'source_id' => $row['source_id'],
            'target_id' => $row['target_id'],
            'relationship' => $row['relationship'],
            'is_bidirectional' => (bool) $row['is_bidirectional'],
            'style' => Style::decode($row['style'] ?? null),
        ];
    }
}
