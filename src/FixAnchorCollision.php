<?php

namespace forumaker\MagicBB;

use s9e\TextFormatter\Renderer;

/**
 * Render-time fix for the ANCHOR BBCode / anchor.fm MediaEmbed tag name collision.
 *
 * See 2.x src/FixAnchorCollision.php for full explanation.
 */
class FixAnchorCollision
{
    public function __invoke(Renderer $renderer, mixed $context, string $xml): string
    {
        if (!str_contains($xml, '<ANCHOR')) {
            return $xml;
        }

        return preg_replace_callback(
            '/<ANCHOR\b[^>]*>(.*?)<\/ANCHOR>/s',
            static function (array $m): string {
                $inner = $m[1];
                if (preg_match('/<s>\[anchor=([^\]]+)\]<\/s>/i', $inner, $name)) {
                    $anchorName = htmlspecialchars($name[1], ENT_XML1);
                    return '<MAGICBB_ANCHOR anchor="' . $anchorName . '">' . $inner . '</MAGICBB_ANCHOR>';
                }
                return $m[0];
            },
            $xml
        ) ?? $xml;
    }
}
