<?php
declare(strict_types=1);

namespace Graphin\Controllers;

use Graphin\ApiException;
use Graphin\Style;
use Graphin\Database;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Nodes are saved links. POST /api/networks/{id}/nodes, PUT|DELETE /api/nodes/{id}
 */
final class NodeController extends BaseController
{
    private const TYPES = ['webpage', 'video', 'image', 'pdf', 'note', 'group'];

    /** POST /api/networks/{id}/nodes {url?, title, type?, favicon_url?, thumbnail_url?, commentary?, x?, y?} */
    public function store(Request $request, Response $response, array $args): Response
    {
        $this->findNetwork($args['id']);
        $data = $this->body($request);

        $url = $this->optionalUrl($data, 'url');
        $title = $this->requiredString($data, 'title', self::TITLE_MAX);
        $type = $this->type($data, $url);
        // A group is a box, not a page: it has no link, and its size is stored.
        $isGroup = $type === 'group';
        if ($isGroup) {
            $url = null;
        }
        $id = Database::uuid();

        $this->db->execute(
            'INSERT INTO nodes (id, network_id, type, url, title, favicon_url, thumbnail_url, commentary, x, y, width, height, shape, style,
                                event_time, latitude, longitude, country)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $id,
                $args['id'],
                $type,
                $url,
                $title,
                $this->optionalUrl($data, 'favicon_url'),
                $this->optionalUrl($data, 'thumbnail_url'),
                $this->optionalString($data, 'commentary', self::COMMENTARY_MAX),
                $this->number($data, 'x'),
                $this->number($data, 'y'),
                $isGroup ? $this->number($data, 'width', 600.0) : null,
                $isGroup ? $this->number($data, 'height', 420.0) : null,
                $isGroup ? $this->shape($data['shape'] ?? 'rect') : null,
                Style::clean($data['style'] ?? null, Style::NODE_KEYS),
                $this->optionalTime($data, 'time'),
                $this->optionalCoordinate($data, 'latitude', 90.0),
                $this->optionalCoordinate($data, 'longitude', 180.0),
                $this->optionalString($data, 'country', 100),
            ]
        );
        return $this->json($response, $this->findNodeOut($id), 201);
    }

    /** PUT /api/nodes/{id} : a field left out keeps its value. */
    public function update(Request $request, Response $response, array $args): Response
    {
        $node = $this->findNode($args['id']);
        $data = $this->body($request);

        $title = array_key_exists('title', $data)
            ? $this->requiredString($data, 'title', self::TITLE_MAX)
            : $node['title'];
        $url = array_key_exists('url', $data) ? $this->optionalUrl($data, 'url') : $node['url'];
        // A group's shape can be changed here; other nodes have no shape.
        $shape = $node['type'] === 'group' && array_key_exists('shape', $data)
            ? $this->shape($data['shape'])
            : $node['shape'];
        $commentary = array_key_exists('commentary', $data)
            ? $this->optionalString($data, 'commentary', self::COMMENTARY_MAX)
            : $node['commentary'];

        // Appearance: a style sent as null resets it to the default look.
        $style = array_key_exists('style', $data)
            ? Style::clean($data['style'], Style::NODE_KEYS)
            : $node['style'];

        // Time and place: a property left out keeps its value; null clears it.
        $time = array_key_exists('time', $data) ? $this->optionalTime($data, 'time') : $node['event_time'];
        $latitude = array_key_exists('latitude', $data) ? $this->optionalCoordinate($data, 'latitude', 90.0) : $node['latitude'];
        $longitude = array_key_exists('longitude', $data) ? $this->optionalCoordinate($data, 'longitude', 180.0) : $node['longitude'];
        $country = array_key_exists('country', $data) ? $this->optionalString($data, 'country', 100) : $node['country'];

        $this->db->execute(
            'UPDATE nodes SET title = ?, url = ?, commentary = ?, shape = ?, style = ?,
                              event_time = ?, latitude = ?, longitude = ?, country = ?
             WHERE id = ?',
            [$title, $url, $commentary, $shape, $style, $time, $latitude, $longitude, $country, $args['id']]
        );
        return $this->json($response, $this->findNodeOut($args['id']));
    }

    /** DELETE /api/nodes/{id} : its edges are removed with it. */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $this->findNode($args['id']);
        $this->db->execute('DELETE FROM nodes WHERE id = ?', [$args['id']]);
        return $response->withStatus(204);
    }

    /** A node is a webpage when it has a link, and a note when it does not, unless a type is given. */
    private function type(array $data, ?string $url): string
    {
        $type = isset($data['type']) ? strtolower(trim((string) $data['type'])) : '';
        if ($type === '') {
            return $this->inferType($url);
        }
        if (!in_array($type, self::TYPES, true)) {
            throw new ApiException(422, '"type" must be one of: ' . implode(', ', self::TYPES) . '.');
        }
        return $type;
    }

    /** A group is drawn as a rectangle or a circle. */
    private function shape(mixed $value): string
    {
        $shape = strtolower(trim((string) $value));
        if (!in_array($shape, ['rect', 'rounded', 'pill', 'ellipse', 'circle'], true)) {
            throw new ApiException(422, '"shape" must be rect, rounded, pill, ellipse or circle.');
        }
        return $shape;
    }

    /**
     * The type from the link itself, when none is given: YouTube and Vimeo are videos, .pdf files are
     * PDFs, picture links are images, and any other link is a web page. No link means a note.
     */
    private function inferType(?string $url): string
    {
        if ($url === null) {
            return 'note';
        }
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $path = strtolower((string) parse_url($url, PHP_URL_PATH));
        if (preg_match('/(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/', $host)) {
            return 'video';
        }
        if (str_ends_with($path, '.pdf')) {
            return 'pdf';
        }
        if (preg_match('/\.(png|jpe?g|gif|webp|svg|avif)$/', $path)) {
            return 'image';
        }
        return 'webpage';
    }

    /** @return array<string, mixed> */
    private function findNodeOut(string $id): array
    {
        $row = $this->findNode($id);
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
}
