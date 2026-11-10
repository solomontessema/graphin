<?php
declare(strict_types=1);

namespace Graphin\Controllers;

use Graphin\ApiException;
use Graphin\Auth;
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
            'SELECT n.id, n.name, n.cover_url, n.tile_color, n.created_at, n.updated_at,
                    (SELECT COUNT(*) FROM nodes d WHERE d.network_id = n.id) AS node_count
             FROM networks n
             ' . (Auth::required() ? 'WHERE n.user_id = ?' : 'WHERE ? IS NULL') . '
             ORDER BY n.updated_at DESC',
            [Auth::required() ? Auth::userId() : null]
        );
        return $this->json($response, array_map([$this, 'summary'], $networks));
    }

    /** POST /api/networks {name} */
    public function store(Request $request, Response $response): Response
    {
        $data = $this->body($request);
        $name = $this->requiredString($data, 'name', self::TITLE_MAX);
        $id = Database::uuid();
        $this->db->execute('INSERT INTO networks (id, name, user_id) VALUES (?, ?, ?)', [$id, $name, Auth::userId()]);
        return $this->json($response, $this->summary($this->findNetwork($id) + ['node_count' => 0]), 201);
    }

    /** PUT /api/networks/{id} {name?, tag_colors?, cover_url?, tile_color?}: a field left out keeps its value. */
    public function update(Request $request, Response $response, array $args): Response
    {
        $this->findNetwork($args['id']);
        $data = $this->body($request);
        $name = array_key_exists('name', $data) ? $this->requiredString($data, 'name', self::TITLE_MAX) : null;
        $colours = array_key_exists('tag_colors', $data) ? $this->cleanTagColors($data['tag_colors']) : false;
        // The cover picture of the home page tile: a link to an image, or null for the default picture.
        $hasCover = array_key_exists('cover_url', $data);
        $cover = $hasCover ? $this->optionalUrl($data, 'cover_url') : null;
        // The tile's background colour such as #1d4ed8, or null for the default.
        $hasTint = array_key_exists('tile_color', $data);
        $tint = $hasTint ? $this->optionalString($data, 'tile_color', 7) : null;
        if ($tint !== null && !preg_match('/^#[0-9a-fA-F]{6}$/', $tint)) {
            throw new ApiException(422, '"tile_color" must be a colour such as #1d4ed8.');
        }
        $this->db->transaction(function (Database $db) use ($name, $colours, $hasCover, $cover, $hasTint, $tint, $args): void {
            if ($name !== null) {
                $db->execute('UPDATE networks SET name = ? WHERE id = ?', [$name, $args['id']]);
            }
            if ($hasTint) {
                $db->execute('UPDATE networks SET tile_color = ? WHERE id = ?', [$tint, $args['id']]);
            }
            if ($hasCover) {
                $db->execute('UPDATE networks SET cover_url = ? WHERE id = ?', [$cover, $args['id']]);
            }
            if ($colours !== false) {
                $db->execute('UPDATE networks SET tag_colors = ? WHERE id = ?', [$colours, $args['id']]);
            }
        });
        $network = $this->findNetwork($args['id']);
        return $this->json($response, $this->summary($network + ['node_count' => 0]) + ['tag_colors' => $this->tagColors($network['tag_colors'] ?? null)]);
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
                    event_time, latitude, longitude, country, refs, tags, created_at, updated_at
             FROM nodes WHERE network_id = ? ORDER BY created_at',
            [$args['id']]
        );
        $edges = $this->db->fetchAll(
            'SELECT id, source_id, target_id, relationship, is_bidirectional, style, tags
             FROM edges WHERE network_id = ? ORDER BY created_at',
            [$args['id']]
        );
        return $this->json($response, [
            'network' => $this->summary($network + ['node_count' => count($nodes)]) + ['tag_colors' => $this->tagColors($network['tag_colors'] ?? null)],
            'nodes' => array_map([$this, 'nodeOut'], $nodes),
            'edges' => array_map([$this, 'edgeOut'], $edges),
        ]);
    }

    /**
     * PUT /api/networks/{id}/restore {nodes, edges}
     * Replaces the canvas with a saved state, keeping every id, so the links still match. Undo and Redo
     * use it. The state is what the graph call returns.
     */
    public function restore(Request $request, Response $response, array $args): Response
    {
        $this->findNetwork($args['id']);
        $data = $this->body($request);
        $nodes = $data['nodes'] ?? null;
        $edges = $data['edges'] ?? null;
        if (!is_array($nodes) || !is_array($edges)) {
            throw new ApiException(422, 'A saved state needs nodes and edges.');
        }
        $this->db->transaction(function (Database $db) use ($nodes, $edges, $args): void {
            $db->execute('DELETE FROM edges WHERE network_id = ?', [$args['id']]);
            $db->execute('DELETE FROM nodes WHERE network_id = ?', [$args['id']]);
            foreach ($nodes as $n) {
                if (!is_array($n) || !isset($n['id'])) {
                    continue;
                }
                $type = (string) ($n['type'] ?? 'webpage');
                $db->execute(
                    'INSERT INTO nodes (id, network_id, type, url, title, favicon_url, thumbnail_url, commentary, x, y,
                                        width, height, shape, style, event_time, latitude, longitude, country, refs, tags)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        (string) $n['id'],
                        $args['id'],
                        $type,
                        $n['url'] ?? null,
                        (string) ($n['title'] ?? ''),
                        $n['favicon_url'] ?? null,
                        $n['thumbnail_url'] ?? null,
                        $n['commentary'] ?? null,
                        (float) ($n['x'] ?? 0),
                        (float) ($n['y'] ?? 0),
                        isset($n['width']) ? (float) $n['width'] : null,
                        isset($n['height']) ? (float) $n['height'] : null,
                        in_array($n['shape'] ?? null, NodeController::SHAPES, true)
                            ? $n['shape']
                            : ($type === 'shape' ? 'rect' : null),
                        Style::clean($n['style'] ?? null, Style::NODE_KEYS),
                        $n['time'] ?? null,
                        $n['latitude'] ?? null,
                        $n['longitude'] ?? null,
                        $n['country'] ?? null,
                        $this->optionalReferences($n),
                        $this->optionalTags($n),
                    ]
                );
            }
            foreach ($edges as $e) {
                if (!is_array($e) || !isset($e['id'])) {
                    continue;
                }
                $db->execute(
                    'INSERT INTO edges (id, network_id, source_id, target_id, relationship, is_bidirectional, style, tags)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        (string) $e['id'],
                        $args['id'],
                        (string) $e['source_id'],
                        (string) $e['target_id'],
                        (string) $e['relationship'],
                        !empty($e['is_bidirectional']) ? 1 : 0,
                        Style::clean($e['style'] ?? null, Style::EDGE_KEYS),
                        $this->optionalTags($e),
                    ]
                );
            }
        });
        return $response->withStatus(204);
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
                // Width and height are sent only for shapes, and are left as they are otherwise.
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
            'cover_url' => $row['cover_url'] ?? null,
            'tile_color' => $row['tile_color'] ?? null,
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
            'shape' => $row['shape'] ?? ($row['type'] === 'shape' ? 'rect' : null),
            'style' => Style::decode($row['style'] ?? null),
            'time' => $row['event_time'] ?? null,
            'latitude' => $row['latitude'] === null ? null : (float) $row['latitude'],
            'longitude' => $row['longitude'] === null ? null : (float) $row['longitude'],
            'country' => $row['country'] ?? null,
            'references' => self::decodeReferences($row['refs'] ?? null),
            'tags' => self::decodeTags($row['tags'] ?? null),
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
            'tags' => self::decodeTags($row['tags'] ?? null),
        ];
    }

    /**
     * The colours a user chose for tags, as JSON for storage: {tag: "#rrggbb"}. Null clears them.
     */
    private function cleanTagColors(mixed $input): ?string
    {
        if ($input === null || $input === []) {
            return null;
        }
        if (!is_array($input) || array_is_list($input) || count($input) > 500) {
            throw new ApiException(422, '"tag_colors" must be an object of tag and colour.');
        }
        $clean = [];
        foreach ($input as $tag => $colour) {
            $tag = self::cleanTag((string) $tag);
            if ($tag === null) {
                continue;
            }
            if (!is_string($colour) || !preg_match('/^#[0-9a-fA-F]{6}$/', $colour)) {
                throw new ApiException(422, "The colour of \"$tag\" must look like #1d4ed8.");
            }
            $clean[$tag] = strtolower($colour);
        }
        return $clean === [] ? null : json_encode($clean, JSON_UNESCAPED_UNICODE);
    }

    /** The colour chosen for each tag of a network, as {tag: "#rrggbb"}. */
    private function tagColors(?string $json): object
    {
        $colours = $json === null || $json === '' ? [] : json_decode($json, true);
        return (object) (is_array($colours) ? $colours : []);
    }
}
