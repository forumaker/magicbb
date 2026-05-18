<?php

namespace forumaker\MagicBB;

use s9e\TextFormatter\Renderer;

/**
 * Render-time fix for the ANCHOR BBCode / anchor.fm MediaEmbed tag name collision.
 *
 * MediaEmbed (via fof-formatting) registers a site called "anchor" (anchor.fm) which
 * creates a tag named ANCHOR with an iframe template. Because MediaEmbed runs after our
 * configure callback, it overwrites our ANCHOR BBCode definition. Our MAGICBB_ANCHOR tag
 * (with the correct span template) survives untouched.
 *
 * This callback intercepts the s9e XML before XSLT rendering and replaces ANCHOR nodes
 * that originated from our [anchor=name] BBCode (identified by the <s>[anchor=...]</s>
 * source-preservation child node) with MAGICBB_ANCHOR nodes, so the correct span
 * template is applied instead of the anchor.fm iframe template.
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
                // s9e stores the original BBCode text in a <s> child element.
                // Our [anchor=name] BBCode always produces <s>[anchor=name]</s>.
                if (preg_match('/<s>\[anchor=([^\]]+)\]<\/s>/i', $inner, $name)) {
                    $anchorName = htmlspecialchars($name[1], ENT_XML1);
                    return '<MAGICBB_ANCHOR anchor="' . $anchorName . '">' . $inner . '</MAGICBB_ANCHOR>';
                }
                // Leave real anchor.fm embeds untouched.
                return $m[0];
            },
            $xml
        ) ?? $xml;
    }
}
