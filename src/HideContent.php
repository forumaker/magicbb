<?php

namespace forumaker\MagicBB;

use Flarum\Http\RequestUtil;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Log\LoggerInterface;
use s9e\TextFormatter\Renderer;
use Symfony\Contracts\Translation\TranslatorInterface;

class HideContent
{
    private static array $likedCache = [];
    private static array $repliedCache = [];

    public function __construct(
        protected TranslatorInterface $translator,
        protected LoggerInterface     $logger,
        protected ConnectionInterface $db,
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

        if ($request === null) {
            return $xml;
        }

        $actor = RequestUtil::getActor($request);
        $post  = $context;

        if ($actor->isGuest()) {
            $msg = $this->translator->trans('forumaker-magicbb.forum.hide.login_to_see_simple');
            $xml = $this->hideTag($xml, 'LOGIN', $msg);
            $xml = $this->hideTag($xml, 'LIKE',  $msg);
            $xml = $this->hideTag($xml, 'REPLY', $msg);
            return $xml;
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

    private function actorLikedPost(User $actor, CommentPost $post): bool
    {
        $aid = (int) $actor->id;
        $did = (int) $post->discussion_id;

        if (!array_key_exists($did, self::$likedCache[$aid] ?? [])) {
            try {
                $ids = $this->db
                    ->table('post_likes')
                    ->join('posts', 'posts.id', '=', 'post_likes.post_id')
                    ->where('posts.discussion_id', $did)
                    ->where('post_likes.user_id', $aid)
                    ->pluck('post_likes.post_id')
                    ->map(fn ($v) => (int) $v)
                    ->all();

                self::$likedCache[$aid][$did] = $ids;
            } catch (\Throwable $e) {
                $this->logger->warning(
                    'forumaker-magicbb: could not load likes for discussion — is flarum/likes installed?',
                    ['exception' => get_class($e) . ': ' . $e->getMessage()]
                );
                self::$likedCache[$aid][$did] = [];
                return false;
            }
        }

        return in_array((int) $post->id, self::$likedCache[$aid][$did], true);
    }

    private function actorHasReplied(User $actor, CommentPost $post): bool
    {
        $aid = (int) $actor->id;
        $did = (int) $post->discussion_id;

        if (!array_key_exists($did, self::$repliedCache[$aid] ?? [])) {
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
            self::$repliedCache[$aid][$did] = $replied;
        }

        return self::$repliedCache[$aid][$did];
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
