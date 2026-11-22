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
        // Tag colours and layers share one column. A call that sends only one of them leaves the other as it is.
        $colours = false;
        if (array_key_exists('tag_colors', $data) || array_key_exists('layers', $data)) {
            $stored = $this->storedParts($this->findNetwork($args['id'])['tag_colors'] ?? null);
            $newColours = array_key_exists('tag_colors', $data) ? $this->cleanTagColors($data['tag_colors']) : $stored['colours'];
            $newLayers = array_key_exists('layers', $data) ? $this->cleanLayers($data['layers']) : $stored['layers'];
            $colours = $this->encodeStored($newColours, $newLayers);
        }
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
        return $this->json($response, $this->summary($network + ['node_count' => 0]) + ['tag_colors' => $this->tagColors($network['tag_colors'] ?? null), 'layers' => $this->layers($network['tag_colors'] ?? null)]);
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
        return $this->json($response, $this->graphOf($this->findNetwork($args['id'])));
    }

    /**
     * The whole canvas of a network as the client reads it.
     *
     * @param array<string, mixed> $network
     * @return array<string, mixed>
     */
    private function graphOf(array $network): array
    {
        $nodes = $this->db->fetchAll(
            'SELECT id, type, url, title, favicon_url, thumbnail_url, commentary, x, y, width, height, shape, style,
                    event_time, latitude, longitude, country, refs, tags, created_at, updated_at
             FROM nodes WHERE network_id = ? ORDER BY created_at',
            [$network['id']]
        );
        $edges = $this->db->fetchAll(
            'SELECT id, source_id, target_id, relationship, is_bidirectional, style, tags
             FROM edges WHERE network_id = ? ORDER BY created_at',
            [$network['id']]
        );
        return [
            'network' => $this->summary($network + ['node_count' => count($nodes)]) + ['tag_colors' => $this->tagColors($network['tag_colors'] ?? null), 'layers' => $this->layers($network['tag_colors'] ?? null)],
            'nodes' => array_map([$this, 'nodeOut'], $nodes),
            'edges' => array_map([$this, 'edgeOut'], $edges),
        ];
    }

    // ---- Sharing: a link that lets anyone read a network, and nothing more ----

    /** GET /api/networks/{id}/share : whether this network is shared, and the secret of its link. */
    public function shareStatus(Request $request, Response $response, array $args): Response
    {
        $token = $this->findNetwork($args['id'])['share_token'] ?? null;
        return $this->json($response, ['shared' => $token !== null, 'token' => $token]);
    }

    /**
     * POST /api/networks/{id}/share {regenerate?} : starts sharing, or returns the link that already exists. With regenerate the old
     * link stops working and a new one is made.
     */
    public function share(Request $request, Response $response, array $args): Response
    {
        $network = $this->findNetwork($args['id']);
        $data = $this->body($request);
        $token = $network['share_token'] ?? null;
        if ($token === null || !empty($data['regenerate'])) {
            $token = bin2hex(random_bytes(24));
            $this->db->execute('UPDATE networks SET share_token = ? WHERE id = ?', [$token, $args['id']]);
        }
        return $this->json($response, ['shared' => true, 'token' => $token]);
    }

    /** DELETE /api/networks/{id}/share : the link stops working. */
    public function unshare(Request $request, Response $response, array $args): Response
    {
        $this->findNetwork($args['id']);
        $this->db->execute('UPDATE networks SET share_token = NULL WHERE id = ?', [$args['id']]);
        return $response->withStatus(204);
    }

    /** GET /api/shared/{token}/graph : the network of a share link, for anyone, to read. Nothing here can change it. */
    public function sharedGraph(Request $request, Response $response, array $args): Response
    {
        return $this->json($response, $this->graphOf($this->findShared($args['token'])));
    }

    /**
     * POST /api/shared/{token}/copy : a copy of a shared network in the account of the person who is signed in. Every tile and
     * link gets a new id, so the copy is theirs to change and the original stays as it is.
     */
    public function copyShared(Request $request, Response $response, array $args): Response
    {
        if (Auth::required() && Auth::userId() === null) {
            throw new ApiException(401, 'Log in to copy this graph into your account.');
        }
        $source = $this->findShared($args['token']);
        $graph = $this->graphOf($source);

        $newId = Database::uuid();
        $ids = [];
        $nodes = [];
        foreach ($graph['nodes'] as $node) {
            $ids[$node['id']] = Database::uuid();
            $nodes[] = ['id' => $ids[$node['id']]] + $node;
        }
        $edges = [];
        foreach ($graph['edges'] as $edge) {
            if (!isset($ids[$edge['source_id']], $ids[$edge['target_id']])) {
                continue;
            }
            $edges[] = ['id' => Database::uuid(), 'source_id' => $ids[$edge['source_id']], 'target_id' => $ids[$edge['target_id']]] + $edge;
        }

        $name = mb_substr((string) $source['name'], 0, 240) . ' (copy)';
        $this->db->transaction(function (Database $db) use ($newId, $name, $source, $nodes, $edges): void {
            $db->execute(
                'INSERT INTO networks (id, name, user_id, tag_colors, cover_url, tile_color) VALUES (?, ?, ?, ?, ?, ?)',
                [$newId, $name, Auth::userId(), $source['tag_colors'] ?? null, $source['cover_url'] ?? null, $source['tile_color'] ?? null]
            );
            $this->insertState($db, $newId, $nodes, $edges);
        });
        return $this->json($response, $this->summary($this->findNetwork($newId) + ['node_count' => count($nodes)]), 201);
    }

    /** The network that a share link opens, or 404 when the link was never made or has been stopped. */
    private function findShared(string $token): array
    {
        $network = preg_match('/^[a-f0-9]{48}$/', $token)
            ? $this->db->fetchOne('SELECT * FROM networks WHERE share_token = ?', [$token])
            : null;
        if ($network === null) {
            throw new ApiException(404, 'This link is not shared, or sharing has been stopped.');
        }
        return $network;
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
            $this->insertState($db, $args['id'], $nodes, $edges);
        });
        return $response->withStatus(204);
    }

    /**
     * Writes the tiles and links of a saved state into a network. The state is what the graph call returns; Undo uses it, and so
     * does copying a shared network.
     *
     * @param array<int, mixed> $nodes
     * @param array<int, mixed> $edges
     */
    private function insertState(Database $db, string $networkId, array $nodes, array $edges): void
    {
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
                    $networkId,
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
                    $networkId,
                    (string) $e['source_id'],
                    (string) $e['target_id'],
                    (string) $e['relationship'],
                    !empty($e['is_bidirectional']) ? 1 : 0,
                    Style::clean($e['style'] ?? null, Style::EDGE_KEYS),
                    $this->optionalTags($e),
                ]
            );
        }
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
     * The colours a user chose for tags, as {tag: "#rrggbb"}.
     *
     * @return array<string, string>
     */
    private function cleanTagColors(mixed $input): array
    {
        if ($input === null || $input === []) {
            return [];
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
        return $clean;
    }

    /**
     * The layers of a network: named groups of tags that can be shown or hidden together, [{id, name, tags}].
     *
     * @return list<array{id: string, name: string, tags: list<string>}>
     */
    private function cleanLayers(mixed $input): array
    {
        if ($input === null || $input === []) {
            return [];
        }
        if (!is_array($input) || !array_is_list($input) || count($input) > 30) {
            throw new ApiException(422, '"layers" must be a list of at most 30 layers.');
        }
        $clean = [];
        $seen = [];
        foreach ($input as $layer) {
            if (!is_array($layer)) {
                throw new ApiException(422, 'Each layer must have an id, a name and tags.');
            }
            $id = substr((string) preg_replace('/[^a-z0-9-]/', '', strtolower((string) ($layer['id'] ?? ''))), 0, 40);
            $name = trim((string) ($layer['name'] ?? ''));
            if ($id === '' || isset($seen[$id])) {
                throw new ApiException(422, 'Each layer needs its own id.');
            }
            if ($name === '') {
                throw new ApiException(422, 'A layer needs a name.');
            }
            $seen[$id] = true;
            $tags = [];
            foreach (is_array($layer['tags'] ?? null) ? $layer['tags'] : [] as $tag) {
                $tag = self::cleanTag((string) $tag);
                if ($tag !== null && !in_array($tag, $tags, true)) {
                    $tags[] = $tag;
                }
            }
            $entry = ['id' => $id, 'name' => mb_substr($name, 0, 60), 'tags' => array_slice($tags, 0, 200)];
            // Optional colours: the line (frame) colour and the shade (fill) of the layer's tiles.
            foreach (['color', 'fill'] as $field) {
                $value = $layer[$field] ?? null;
                if (is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) === 1) {
                    $entry[$field] = strtolower($value);
                }
            }
            $clean[] = $entry;
        }
        return $clean;
    }

    /**
     * The column holds the tag colours and, under the key __layers, the layers. (One column, so the server needs no new one.)
     *
     * @return array{colours: array<string, string>, layers: array<int, mixed>}
     */
    private function storedParts(?string $json): array
    {
        $all = $json === null || $json === '' ? [] : json_decode($json, true);
        $all = is_array($all) ? $all : [];
        $layers = is_array($all['__layers'] ?? null) ? $all['__layers'] : [];
        unset($all['__layers']);
        return ['colours' => $all, 'layers' => $layers];
    }

    /**
     * @param array<string, string> $colours
     * @param array<int, mixed> $layers
     */
    private function encodeStored(array $colours, array $layers): ?string
    {
        if ($layers !== []) {
            $colours['__layers'] = $layers;
        }
        return $colours === [] ? null : json_encode($colours, JSON_UNESCAPED_UNICODE);
    }

    /** The colour chosen for each tag of a network, as {tag: "#rrggbb"}. */
    private function tagColors(?string $json): object
    {
        return (object) $this->storedParts($json)['colours'];
    }

    /**
     * The layers of a network.
     *
     * @return array<int, mixed>
     */
    private function layers(?string $json): array
    {
        return $this->storedParts($json)['layers'];
    }
}
