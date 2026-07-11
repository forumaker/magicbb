<?php

namespace forumaker\MagicBB;

use Flarum\Http\RequestUtil;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Log\LoggerInterface;
use s9e\TextFormatter\Renderer;
use Symfony\Contracts\Translation\TranslatorInterface;

class HideContent
{
    private array $likedCache = [];
    private array $repliedCache = [];

    public function __construct(
        protected TranslatorInterface $translator,
        protected LoggerInterface     $logger,
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

        // No request context (email notification rendering, CLI commands, queue
        // jobs, …) means we can't identify an actor. Treat this conservatively as
        // an unauthenticated/guest context rather than leaking the gated content.
        if ($request === null) {
            return $this->redactAsGuest($xml);
        }

        $actor = RequestUtil::getActor($request);
        $post  = $context;

        if ($actor->isGuest()) {
            return $this->redactAsGuest($xml);
        }

        $xml = $this->revealTag($xml, 'LOGIN');

        $isAuthor = (int) $actor->id === (int) $post->user_id;

        if ($this->hasTag($xml, 'LIKE')) {
            if ($isAuthor || $actor->hasPermission('post.bypasslikeRequirement')) {
                $xml = $this->revealTag($xml, 'LIKE');
            } else {
                $liked = $this->actorLikedPost($actor, $post);
                $xml   = $liked
                    ? $this->revealTag($xml, 'LIKE')
                    : $this->hideTag($xml, 'LIKE', $this->translator->trans('forumaker-magicbb.forum.hide.like_to_see_simple'));
            }
        }

        if ($this->hasTag($xml, 'REPLY')) {
            if ($isAuthor || $actor->hasPermission('post.bypassreplyRequirement')) {
                $xml = $this->revealTag($xml, 'REPLY');
            } else {
                $replied = $this->actorHasReplied($actor, $post);
                $xml     = $replied
                    ? $this->revealTag($xml, 'REPLY')
                    : $this->hideTag($xml, 'REPLY', $this->translator->trans('forumaker-magicbb.forum.hide.reply_to_see_simple'));
            }
        }

        return $xml;
    }

    private function redactAsGuest(string $xml): string
    {
        $msg = $this->translator->trans('forumaker-magicbb.forum.hide.login_to_see_simple');
        $xml = $this->hideTag($xml, 'LOGIN', $msg);
        $xml = $this->hideTag($xml, 'LIKE',  $msg);
        $xml = $this->hideTag($xml, 'REPLY', $msg);

        return $xml;
    }

    private function actorLikedPost(User $actor, CommentPost $post): bool
    {
        $aid = (int) $actor->id;
        $did = (int) $post->discussion_id;

        if (!array_key_exists($did, $this->likedCache[$aid] ?? [])) {
            $ids = [];

            // flarum/likes is optional and registers the likes() relation on
            // CommentPost as a macro (not a real method), so it can't be probed with
            // method_exists()/class_exists(). Attempt the query through the model
            // layer and fall back gracefully if the relation isn't registered.
            try {
                $ids = Post::where('discussion_id', $did)
                    ->whereHas('likes', fn ($q) => $q->where('id', $aid))
                    ->pluck('id')
                    ->map(fn ($v) => (int) $v)
                    ->all();
            } catch (\Throwable $e) {
                $this->logger->warning(
                    'forumaker-magicbb: could not load likes for discussion — is flarum/likes installed?',
                    ['exception' => get_class($e) . ': ' . $e->getMessage()]
                );
            }

            $this->likedCache[$aid][$did] = $ids;
        }

        return in_array((int) $post->id, $this->likedCache[$aid][$did], true);
    }

    private function actorHasReplied(User $actor, CommentPost $post): bool
    {
        $aid = (int) $actor->id;
        $did = (int) $post->discussion_id;

        if (!array_key_exists($did, $this->repliedCache[$aid] ?? [])) {
            $replied = false;
            try {
                $replied = Post::where('user_id', $aid)
                    ->where('discussion_id', $did)
                    ->where('type', 'comment')
                    ->exists();
            } catch (\Throwable $e) {
                $this->logger->warning(
                    'forumaker-magicbb: could not query posts for reply check',
                    ['exception' => get_class($e) . ': ' . $e->getMessage()]
                );
            }
            $this->repliedCache[$aid][$did] = $replied;
        }

        return $this->repliedCache[$aid][$did];
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
