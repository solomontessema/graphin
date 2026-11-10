<?php
declare(strict_types=1);

namespace Graphin\Controllers;

use Graphin\ApiException;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * GET /api/embeddable?url=... : whether a page may be shown inside another page (an iframe).
 * Only the response headers are read. A page whose headers forbid framing answers false, and so does any
 * address that cannot be reached or that points at a private network.
 */
final class PageController extends BaseController
{
    public function embeddable(Request $request, Response $response): Response
    {
        $url = (string) ($request->getQueryParams()['url'] ?? '');
        $parts = parse_url($url);
        if (!is_array($parts) || !in_array($parts['scheme'] ?? '', ['http', 'https'], true) || empty($parts['host'])) {
            throw new ApiException(422, 'A web address is needed.');
        }
        return $this->json($response, ['embeddable' => $this->mayFrame($url, $parts['host'])]);
    }

    private function mayFrame(string $url, string $host): bool
    {
        $ip = gethostbyname($host);
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false;
        }
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 6,
                'ignore_errors' => true,
                'follow_location' => 1,
                'max_redirects' => 5,
                'header' => "User-Agent: Mozilla/5.0 (Graphin)\r\nAccept: text/html,*/*;q=0.8\r\n",
            ],
        ]);
        // Reading one byte is enough: the headers arrive before the body, and the rest is not needed.
        $body = @file_get_contents($url, false, $context, 0, 1);
        $headers = $http_response_header ?? [];
        if ($body === false && $headers === []) {
            return false;
        }

        // Only the last response counts, after any redirects.
        $last = [];
        foreach ($headers as $line) {
            if (str_starts_with($line, 'HTTP/')) {
                $last = [];
                continue;
            }
            $colon = strpos($line, ':');
            if ($colon !== false) {
                $last[strtolower(trim(substr($line, 0, $colon)))] = trim(substr($line, $colon + 1));
            }
        }

        if (isset($last['x-frame-options'])) {
            return false;
        }
        $policy = $last['content-security-policy'] ?? '';
        if (preg_match('/frame-ancestors\s+([^;]+)/i', $policy, $match) === 1 && !str_contains($match[1], '*')) {
            return false;
        }
        return true;
    }
}
