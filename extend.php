<?php

namespace forumaker\MagicBB;

use forumaker\MagicBB\Listener\AssertIframePermission;
use Flarum\Extend;
use Flarum\Post\Event\Saving as PostSaving;

return [
    (new Extend\Formatter())->configure(Configure::class),

    new Extend\Locales(__DIR__ . '/resources/locale'),

    (new Extend\Frontend('forum'))
        ->css(__DIR__ . '/resources/less/forum.less')
        ->js(__DIR__ . '/js/dist/forum.js'),

    (new Extend\Frontend('admin'))
        ->css(__DIR__ . '/resources/less/admin.less')
        ->js(__DIR__ . '/js/dist/admin.js'),

    (new Extend\Settings())
        ->default('forumaker-magicbb.bb_center', '1')
        ->default('forumaker-magicbb.bb_justify', '1')
        ->default('forumaker-magicbb.bb_color', '1')
        ->default('forumaker-magicbb.bb_spoiler', '1')
        ->default('forumaker-magicbb.bb_table', '1')
        ->default('forumaker-magicbb.bb_info', '1')
        ->default('forumaker-magicbb.bb_image', '1')
        ->default('forumaker-magicbb.bb_iframe', '1')
        ->default('forumaker-magicbb.toolbar_group', '0')
        ->default('forumaker-magicbb.icon_center',  'fas fa-align-center')
        ->default('forumaker-magicbb.icon_justify', 'fas fa-align-justify')
        ->default('forumaker-magicbb.icon_color',   'fas fa-palette')
        ->default('forumaker-magicbb.icon_spoiler', 'fas fa-layer-group')
        ->default('forumaker-magicbb.icon_table',   'fas fa-table')
        ->default('forumaker-magicbb.icon_info',    'fas fa-info-circle')
        ->default('forumaker-magicbb.icon_image',   'fas fa-image')
        ->default('forumaker-magicbb.icon_more',    'fas fa-wand-sparkles')
        ->serializeToForum('bb_center',  'forumaker-magicbb.bb_center',  'boolval')
        ->serializeToForum('bb_justify', 'forumaker-magicbb.bb_justify', 'boolval')
        ->serializeToForum('bb_color',   'forumaker-magicbb.bb_color',   'boolval')
        ->serializeToForum('bb_spoiler', 'forumaker-magicbb.bb_spoiler', 'boolval')
        ->serializeToForum('bb_table',   'forumaker-magicbb.bb_table',   'boolval')
        ->serializeToForum('bb_info',    'forumaker-magicbb.bb_info',    'boolval')
        ->serializeToForum('bb_image',   'forumaker-magicbb.bb_image',   'boolval')
        ->serializeToForum('bb_iframe',  'forumaker-magicbb.bb_iframe',  'boolval')
        ->serializeToForum('bb_toolbar_group', 'forumaker-magicbb.toolbar_group', 'boolval')
        ->serializeToForum('icon_center',  'forumaker-magicbb.icon_center')
        ->serializeToForum('icon_justify', 'forumaker-magicbb.icon_justify')
        ->serializeToForum('icon_color',   'forumaker-magicbb.icon_color')
        ->serializeToForum('icon_spoiler', 'forumaker-magicbb.icon_spoiler')
        ->serializeToForum('icon_table',   'forumaker-magicbb.icon_table')
        ->serializeToForum('icon_info',    'forumaker-magicbb.icon_info')
        ->serializeToForum('icon_image',   'forumaker-magicbb.icon_image')
        ->serializeToForum('icon_more',    'forumaker-magicbb.icon_more'),

    (new Extend\Event())
        ->listen(PostSaving::class, AssertIframePermission::class),
];