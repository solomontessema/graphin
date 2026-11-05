<?php
declare(strict_types=1);

namespace Graphin;

/**
 * Appearance of nodes, groups, and links, stored as JSON in a "style" column. Only the keys a kind of
 * item accepts are kept, colours must be #rrggbb, and widths are between 0 and 12 in steps of 0.5.
 */
final class Style
{
    /** Keys for nodes and groups: the background, the frame colour and width, and the text colour. */
    public const NODE_KEYS = ['fill', 'stroke', 'width', 'text'];
    /** Keys for links: the line colour and the line weight. */
    public const EDGE_KEYS = ['stroke', 'width'];

    private const COLOUR = '/^#[0-9a-fA-F]{6}$/';
    private const WIDTH_MAX = 12.0;

    /**
     * Checks a submitted style and returns it as JSON, or null when nothing is set.
     *
     * @param mixed $input the "style" value from the request
     * @param list<string> $keys NODE_KEYS or EDGE_KEYS
     */
    public static function clean(mixed $input, array $keys): ?string
    {
        if ($input === null) {
            return null;
        }
        if (!is_array($input)) {
            throw new ApiException(422, '"style" must be an object.');
        }
        $clean = [];
        foreach ($keys as $key) {
            if (!isset($input[$key]) || $input[$key] === '') {
                continue;
            }
            $value = $input[$key];
            if ($key === 'width') {
                if (!is_numeric($value) || (float) $value < 0 || (float) $value > self::WIDTH_MAX) {
                    throw new ApiException(422, '"width" must be between 0 and 12.');
                }
                $clean['width'] = round((float) $value * 2) / 2;
                continue;
            }
            if (!is_string($value) || !preg_match(self::COLOUR, $value)) {
                throw new ApiException(422, "\"$key\" must be a colour such as #1d4ed8.");
            }
            $clean[$key] = strtolower($value);
        }
        return $clean === [] ? null : (string) json_encode($clean);
    }

    /** The stored style as an array for the API output, or null. */
    public static function decode(?string $json): ?array
    {
        if ($json === null || $json === '') {
            return null;
        }
        $data = json_decode($json, true);
        return is_array($data) ? $data : null;
    }
}
