<?php
declare(strict_types=1);

namespace Graphin\Controllers;

use Graphin\ApiException;
use Graphin\Database;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Shared helpers for JSON input and output and for validating fields.
 */
abstract class BaseController
{
    protected const URL_MAX = 2048;
    protected const TITLE_MAX = 255;
    protected const COMMENTARY_MAX = 20000;
    protected const RELATIONSHIP_PATTERN = '/^[A-Z_]{1,50}$/';

    public function __construct(protected Database $db)
    {
    }

    /** @return array<string, mixed> */
    protected function body(Request $request): array
    {
        $data = json_decode((string) $request->getBody(), true);
        if ($data === null && trim((string) $request->getBody()) !== '' && json_last_error() !== JSON_ERROR_NONE) {
            throw new ApiException(400, 'Request body is not valid JSON.');
        }
        return is_array($data) ? $data : [];
    }

    protected function json(Response $response, mixed $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type', 'application/json')->withStatus($status);
    }

    /** @param array<string, mixed> $data */
    protected function requiredString(array $data, string $key, int $max): string
    {
        $value = isset($data[$key]) ? trim((string) $data[$key]) : '';
        if ($value === '') {
            throw new ApiException(422, "\"$key\" is required.");
        }
        if (mb_strlen($value) > $max) {
            throw new ApiException(422, "\"$key\" is longer than $max characters.");
        }
        return $value;
    }

    /** @param array<string, mixed> $data */
    protected function optionalString(array $data, string $key, int $max): ?string
    {
        if (!isset($data[$key]) || $data[$key] === null) {
            return null;
        }
        $value = trim((string) $data[$key]);
        if ($value === '') {
            return null;
        }
        if (mb_strlen($value) > $max) {
            throw new ApiException(422, "\"$key\" is longer than $max characters.");
        }
        return $value;
    }

    /**
     * Accepts only http and https links. Anything else (javascript:, data:, file:) is refused,
     * because the link is later opened in an iframe and a new tab.
     *
     * @param array<string, mixed> $data
     */
    protected function optionalUrl(array $data, string $key): ?string
    {
        $url = $this->optionalString($data, $key, self::URL_MAX);
        if ($url === null) {
            return null;
        }
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = (string) parse_url($url, PHP_URL_HOST);
        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new ApiException(422, "\"$key\" must be an http or https address.");
        }
        return $url;
    }

    /** @param array<string, mixed> $data */
    protected function number(array $data, string $key, float $default = 0.0): float
    {
        if (!isset($data[$key])) {
            return $default;
        }
        if (!is_numeric($data[$key])) {
            throw new ApiException(422, "\"$key\" must be a number.");
        }
        return (float) $data[$key];
    }

    /**
     * A point in time, as far as it is known: 1945, 1945-08, 1945-08-06, or 1945-08-06T14:30. Partial dates
     * are allowed, because history often has no day. Null or an empty value clears the time.
     *
     * @param array<string, mixed> $data
     */
    protected function optionalTime(array $data, string $key): ?string
    {
        $value = $this->optionalString($data, $key, 16);
        if ($value === null) {
            return null;
        }
        if (!preg_match('/^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2})?)?)?$/', $value)) {
            throw new ApiException(422, "\"$key\" must look like 1945, 1945-08, 1945-08-06 or 1945-08-06T14:30.");
        }
        return $value;
    }

    /**
     * A latitude (limit 90) or longitude (limit 180). Null or an empty value clears it.
     *
     * @param array<string, mixed> $data
     */
    protected function optionalCoordinate(array $data, string $key, float $limit): ?float
    {
        if (!isset($data[$key]) || $data[$key] === '' || $data[$key] === null) {
            return null;
        }
        if (!is_numeric($data[$key]) || abs((float) $data[$key]) > $limit) {
            throw new ApiException(422, "\"$key\" must be a number between -$limit and $limit.");
        }
        return (float) $data[$key];
    }

    /** Looks up a network by id, or responds 404. */
    protected function findNetwork(string $id): array
    {
        $network = $this->db->fetchOne('SELECT * FROM networks WHERE id = ?', [$id]);
        if ($network === null) {
            throw new ApiException(404, 'Network not found.');
        }
        return $network;
    }

    /** Looks up a node by id, or responds 404. */
    protected function findNode(string $id): array
    {
        $node = $this->db->fetchOne('SELECT * FROM nodes WHERE id = ?', [$id]);
        if ($node === null) {
            throw new ApiException(404, 'Node not found.');
        }
        return $node;
    }
}
