<?php
declare(strict_types=1);

namespace Graphin;

/**
 * Who is making this request. The web product has accounts: every network belongs to one user, and a request without
 * a signed-in user is refused. The desktop app is one person's own computer, so it runs without accounts.
 */
final class Auth
{
    private static bool $required = true;
    private static ?string $userId = null;

    public static function configure(bool $required): void
    {
        self::$required = $required;
    }

    /** True when requests must come from a signed-in user (the web product); false on the desktop. */
    public static function required(): bool
    {
        return self::$required;
    }

    public static function setUser(?string $userId): void
    {
        self::$userId = $userId;
    }

    public static function userId(): ?string
    {
        return self::$userId;
    }
}
