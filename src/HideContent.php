<?php

namespace forumaker\MagicBB;

use Flarum\Http\RequestUtil;
use Flarum\Post\CommentPost;
use Flarum\User\Guest;
use Psr\Http\Message\ServerRequestInterface;
use s9e\TextFormatter\Renderer;
use Symfony\Contracts\Translation\TranslatorInterface;

class HideContent
{
    public function __construct(
        protected TranslatorInterface $translator
    ) {}

    public function __invoke(
        Renderer $renderer,
        mixed $context,
        string $xml,
        ?ServerRequestInterface $request = null
    ): string {
        if (!$context instanceof CommentPost) {
            return $xml;
        }

        if (!$this->containsHideTags($xml)) {
            return $xml;
        }

        $actor = $request ? RequestUtil::getActor($request) : new Guest();
        $post  = $context;

        if ($actor->isGuest()) {
            $msg = $this->translator->trans('forumaker-magicbb.forum.hide.login_to_see_simple');
            $xml = $this->hideTag($xml, 'LOGIN', $msg);
            $xml = $this->hideTag($xml, 'LIKE',  $msg);
            $xml = $this->hideTag($xml, 'REPLY', $msg);
            return $xml;
        }

        $xml = $this->revealTag($xml, 'LOGIN');

        $isAuthor = $actor->id === $post->user_id;

        if ($this->hasTag($xml, 'LIKE')) {
            if ($isAuthor || $actor->hasPermission('post.bypasslikeRequirement')) {
                $xml = $this->revealTag($xml, 'LIKE');
            } else {
                $liked = false;
                try {
                    $liked = $post->likes()->where('user_id', $actor->id)->exists();
                } catch (\Throwable $e) {}

                $xml = $liked
                    ? $this->revealTag($xml, 'LIKE')
                    : $this->hideTag($xml, 'LIKE', $this->translator->trans('forumaker-magicbb.forum.hide.like_to_see_simple'));
            }
        }

        if ($this->hasTag($xml, 'REPLY')) {
            if ($isAuthor || $actor->hasPermission('post.bypassreplyRequirement')) {
                $xml = $this->revealTag($xml, 'REPLY');
            } else {
                $replied = false;
                try {
                    $replied = $post->discussion
                        ->posts()
                        ->where('user_id', $actor->id)
                        ->where('id', '!=', $post->id)
                        ->exists();
                } catch (\Throwable $e) {
                    try {
                        $replied = $post->mentionedBy()
                            ->where('user_id', $actor->id)
                            ->exists();
                    } catch (\Throwable $e2) {}
                }

                $xml = $replied
                    ? $this->revealTag($xml, 'REPLY')
                    : $this->hideTag($xml, 'REPLY', $this->translator->trans('forumaker-magicbb.forum.hide.reply_to_see_simple'));
            }
        }

        return $xml;
    }

    private function containsHideTags(string $xml): bool
    {
        return str_contains($xml, '<LOGIN')
            || str_contains($xml, '<LIKE')
            || str_contains($xml, '<REPLY');
    }

    private function hasTag(string $xml, string $tag): bool
    {
        return str_contains($xml, '<' . $tag);
    }

    private function revealTag(string $xml, string $tag): string
    {
        return preg_replace(
            '/<' . $tag . '>(?:<s>[^<]*<\/s>)?(.*?)(?:<e>[^<]*<\/e>)?<\/' . $tag . '>/si',
            '$1',
            $xml
        ) ?? $xml;
    }

    private function hideTag(string $xml, string $tag, string $message): string
    {
        $escaped = htmlspecialchars($message, ENT_XML1);
        return preg_replace(
            '/<' . $tag . '>(?:<s>[^<]*<\/s>)?.*?(?:<e>[^<]*<\/e>)?<\/' . $tag . '>/si',
            '<' . $tag . '>' . $escaped . '</' . $tag . '>',
            $xml
        ) ?? $xml;
    }
}