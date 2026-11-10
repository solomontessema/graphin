<?php
declare(strict_types=1);

namespace Graphin;

/**
 * Appearance of nodes, shapes, and links, stored as JSON in a "style" column. Only the keys a kind of
 * item accepts are kept, colours must be #rrggbb, and widths are between 0 and 12 in steps of 0.5.
 * A shape also has a line type (solid, dashed or dotted) and a fill opacity from 0 to 1.
 */
final class Style
{
    /** Keys for nodes and shapes: the background, the frame colour and width, and the text colour. */
    public const NODE_KEYS = ['fill', 'stroke', 'width', 'text', 'dash', 'opacity', 'points'];
    /** Keys for links: the line colour and the line weight. */
    public const EDGE_KEYS = ['stroke', 'width', 'bx', 'by', 'pts'];

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
            if ($key === 'dash') {
                if (!in_array($value, ['solid', 'dashed', 'dotted'], true)) {
                    throw new ApiException(422, '"dash" must be solid, dashed or dotted.');
                }
                $clean['dash'] = $value;
                continue;
            }
            if ($key === 'pts') {
                // The points a bent link passes through: [x, y] offsets from the middle of the straight line.
                if (!is_array($value) || count($value) > 40) {
                    throw new ApiException(422, '"pts" must be a list of at most 40 points.');
                }
                $points = [];
                foreach ($value as $point) {
                    if (!is_array($point) || count($point) !== 2 || !is_numeric($point[0] ?? null) || !is_numeric($point[1] ?? null) || abs((float) $point[0]) > 1000000 || abs((float) $point[1]) > 1000000) {
                        throw new ApiException(422, 'Each point in "pts" must be [x, y] numbers.');
                    }
                    $points[] = [round((float) $point[0], 1), round((float) $point[1], 1)];
                }
                if ($points !== []) {
                    $clean['pts'] = $points;
                }
                continue;
            }
            if ($key === 'bx' || $key === 'by') {
                // How far a bent link's middle point has been dragged from the straight line's middle, in canvas units.
                if (!is_numeric($value) || abs((float) $value) > 1000000) {
                    throw new ApiException(422, "\"$key\" must be a number.");
                }
                $clean[$key] = round((float) $value, 1);
                continue;
            }
            if ($key === 'points') {
                // The corners of a drawn polygon in a 100 by 100 box: "x,y x,y x,y", at least three.
                if (!is_string($value) || strlen($value) > 2000 || !preg_match('/^-?\d+(\.\d+)?,-?\d+(\.\d+)?( -?\d+(\.\d+)?,-?\d+(\.\d+)?){2,}$/', $value)) {
                    throw new ApiException(422, '"points" must be at least three corners such as "0,0 100,0 50,100".');
                }
                $clean['points'] = $value;
                continue;
            }
            if ($key === 'opacity') {
                if (!is_numeric($value) || (float) $value < 0 || (float) $value > 1) {
                    throw new ApiException(422, '"opacity" must be between 0 and 1.');
                }
                $clean['opacity'] = round((float) $value, 2);
                continue;
            }
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
