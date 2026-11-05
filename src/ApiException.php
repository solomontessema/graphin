<?php
declare(strict_types=1);

namespace Graphin;

use RuntimeException;

/**
 * An error that is safe to show to the client: it carries an HTTP status and a message.
 */
final class ApiException extends RuntimeException
{
    public function __construct(private int $status, string $message)
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }
}
