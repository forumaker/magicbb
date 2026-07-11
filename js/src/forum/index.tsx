import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import Post from 'flarum/common/models/Post';
import styleSelectedText from 'flarum/common/utils/styleSelectedText';

import Component from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import ColorPalettePopover, { DEFAULT_COLORS } from './components/ColorPalettePopover';
import AlertPickerPopover from './components/AlertPickerPopover';
import ImageAlignPopover from './components/ImageAlignPopover';
import MoreButtonsPopover from './components/MoreButtonsPopover';

function elOf(ctx) {
  return ctx?.attrs?.composer?.editor?.el || null;
}
function edOf(ctx) {
  return ctx?.attrs?.composer?.editor || null;
}
function on(key) {
  const v = app.forum.attribute(key);
  return v === undefined || v === null ? true : !!v;
}
function iconOf(name, fallback) {
  return app.forum.attribute(`icon_${name}`) || fallback;
}
function findFoFTagAroundSelection(node) {
  const re =
    /\[upl-image-preview(?:(?!]).)*?\burl=(?:"[^"]+"|'[^']+'|[^\s\]]+)(?:(?!]).)*?](?:\s*\[\/upl-image-preview])?/i;
  const start = Math.max(0, node.selectionStart - 800);
  const end = Math.min(node.value.length, node.selectionEnd + 800);
  const slice = node.value.slice(start, end);
  const m = slice.match(re);
  if (!m) return null;
  const absStart = start + m.index;
  const absEnd = absStart + m[0].length;
  return { start: absStart, end: absEnd, text: m[0] };
}
function replaceRange(node, from, to, text) {
  node.setRangeText(text, from, to, 'end');
  node.dispatchEvent(new Event('input', { bubbles: true }));
}

function isTiptap(ed: any): boolean {
  return !!(ed && ed.editor && typeof ed.editor.state !== 'undefined');
}

function getSelectedText(node: any, ed: any, start: number, end: number): string {
  if (node) return node.value.slice(start, end);
  return ed?.editor?.state?.doc?.textBetween(start, end, ' ') ?? '';
}

function replaceRangeUnified(node: any, ed: any, start: number, end: number, text: string) {
  if (node) {
    replaceRange(node, start, end, text);
  } else {
    ed.insertBetween(start, end, text, true);
  }
}

class MagicbbBtn extends Component<{ title: string; icon: string; onclick: (e: any) => void }> {
  view() {
    const { title, icon, onclick } = this.attrs;
    const button = m('button.Button.Button--icon.Button--link', { type: 'button', onclick },
      m(Icon, { name: icon })
    );
    return m(Tooltip, { text: title }, button);
  }
}

app.initializers.add('forumaker-magicbb-buttons', () => {
  extend(TextEditor.prototype, 'toolbarItems', function (items) {
    const el = () => elOf(this);
    const editor = () => edOf(this);
    const grouped = on('bb_toolbar_group');

    const pool = [];

    const addBtn = (key, icon, title, style, prio, defaultText = '') => {
      const handler = (e) => {
        e?.preventDefault?.();
        const node = el();
        const ed = editor();
        if (!ed) return;

        if (isTiptap(ed)) {
          const [start, end] = ed.getSelectionRange();
          const hasSelection = start !== end;
          const prefix = style.prefix || '';
          const suffix = style.suffix || '';
          if (!hasSelection) {
            ed.insertAtCursor(prefix + (defaultText || '') + suffix, true);
          } else {
            const selected = getSelectedText(node, ed, start, end);
            replaceRangeUnified(node, ed, start, end, prefix + selected + suffix);
          }
          return;
        }

        if (!node) return;
        const hasSelection = node.selectionStart !== node.selectionEnd;
        if (!hasSelection && defaultText) {
          ed.insertAtCursor((style.prefix || '') + defaultText + (style.suffix || ''));
        } else {
          styleSelectedText(node, style);
        }
      };

      pool.push({
        key,
        prio,
        title,
        icon,
        vnode: m(MagicbbBtn, { title, icon, onclick: handler }),
        asMenu: () => ({ key, title, icon, onClick: handler }),
      });
    };

    const addWrapBlockBtn = (key, icon, title, tag, prio) => {
      const handler = (e) => {
        e?.preventDefault?.();
        const node = el();
        const ed = editor();
        if (!ed) return;

        const open = `[${tag}]`;
        const close = `[/${tag}]`;

        if (isTiptap(ed)) {
          const [start, end] = ed.getSelectionRange();
          if (start === end) {
            ed.insertAtCursor(open + close, true);
          } else {
            const selected = getSelectedText(node, ed, start, end);
            replaceRangeUnified(node, ed, start, end, `${open}${selected}${close}`);
          }
          return;
        }

        if (!node) return;
        const start = node.selectionStart;
        const end = node.selectionEnd;

        if (start === end) {
          const insert = open + close;
          node.setRangeText(insert, start, start, 'end');
          node.dispatchEvent(new Event('input', { bubbles: true }));
          const cursor = start + open.length;
          requestAnimationFrame(() => {
            node.focus();
            node.setSelectionRange(cursor, cursor);
          });
          return;
        }

        const selected = node.value.slice(start, end);
        const wrapped = `${open}${selected}${close}`;
        replaceRange(node, start, end, wrapped);
      };

      pool.push({
        key,
        prio,
        title,
        icon,
        vnode: m(MagicbbBtn, { title, icon, onclick: handler }),
        asMenu: () => ({ key, title, icon, onClick: handler }),
      });
    };

    if (on('bb_center')) {
      addWrapBlockBtn(
        'bb-center',
        iconOf('center', 'fas fa-align-center'),
        app.translator.trans('forumaker-magicbb.forum.composer.center_button'),
        'center',
        100
      );
    }
    if (on('bb_justify')) {
      addWrapBlockBtn(
        'bb-justify',
        iconOf('justify', 'fas fa-align-justify'),
        app.translator.trans('forumaker-magicbb.forum.composer.justify_button'),
        'justify',
        99
      );
    }

    if (on('bb_color')) {
      const label = app.translator.trans('forumaker-magicbb.forum.composer.color_button');
      const colorIcon = iconOf('color', 'fas fa-palette');

      const handleColorSelect = (hex: string) => {
        const node = el();
        const ed = editor();
        if (!ed) return;

        const prefix = `[color=${hex}]`;
        const suffix = '[/color]';

        if (isTiptap(ed)) {
          const [start, end] = ed.getSelectionRange();
          if (start === end) {
            ed.insertAtCursor(`${prefix}Heading${suffix}`, true);
          } else {
            const selected = getSelectedText(node, ed, start, end);
            replaceRangeUnified(node, ed, start, end, `${prefix}${selected}${suffix}`);
          }
          return;
        }

        if (!node) return;
        const hasSelection = node.selectionStart !== node.selectionEnd;
        if (!hasSelection) ed.insertAtCursor(`${prefix}Heading${suffix}`);
        else styleSelectedText(node, { prefix, suffix });
      };

      pool.push({
        key: 'bb-color',
        prio: 98,
        title: label,
        icon: colorIcon,
        vnode: m(ColorPalettePopover, { label, icon: colorIcon, colors: DEFAULT_COLORS, onSelect: handleColorSelect }),
        asMenuSub: () => ({
          key: 'bb-color',
          title: label,
          icon: colorIcon,
          renderSub: () => m(ColorPalettePopover, { label, icon: colorIcon, colors: DEFAULT_COLORS, onSelect: handleColorSelect }),
        }),
      });
    }

    if (on('bb_spoiler')) {
      addBtn(
        'bb-spoiler',
        iconOf('spoiler', 'fas fa-layer-group'),
        app.translator.trans('forumaker-magicbb.forum.composer.spoiler_button'),
        { prefix: '[spoiler title=Heading]', suffix: '[/spoiler]' },
        97,
        'Subtitle'
      );
    }

    if (on('bb_table')) {
      const title = app.translator.trans('forumaker-magicbb.forum.composer.table_button');
      const tableIcon = iconOf('table', 'fas fa-table');
      const handler = (e) => {
        e?.preventDefault?.();
        const ed = editor();
        if (!ed?.insertAtCursor) return;
        const tpl =
          '| Heading 1 | Heading 2 | Heading 3 |\n|---|---|---|\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |';
        ed.insertAtCursor(tpl, true);
      };

      pool.push({
        key: 'bb-table',
        prio: 96,
        title,
        icon: tableIcon,
        vnode: m(MagicbbBtn, { title, icon: tableIcon, onclick: handler }),
        asMenu: () => ({ key: 'bb-table', title, icon: tableIcon, onClick: handler }),
      });
    }

    if (on('bb_info')) {
      const label = app.translator.trans('forumaker-magicbb.forum.composer.info_button');
      const infoIcon = iconOf('info', 'fas fa-info-circle');

      const handleAlertSelect = (a: any) => {
        const node = el();
        const ed = editor();
        if (!ed) return;

        const tag = a.key;
        const prefix = `[${tag} title=Heading font=${a.font} bg=${a.bg} border=${a.border}]`;
        const suffix = `[/${tag}]`;

        if (isTiptap(ed)) {
          const [start, end] = ed.getSelectionRange();
          if (start === end) {
            ed.insertAtCursor(`${prefix}Subtitle${suffix}`, true);
          } else {
            const selected = getSelectedText(node, ed, start, end);
            replaceRangeUnified(node, ed, start, end, `${prefix}${selected}${suffix}`);
          }
          return;
        }

        if (!node) return;
        const hasSelection = node.selectionStart !== node.selectionEnd;
        if (!hasSelection) ed.insertAtCursor(`${prefix}Subtitle${suffix}`);
        else styleSelectedText(node, { prefix, suffix });
      };

      pool.push({
        key: 'bb-info',
        prio: 95.5,
        title: label,
        icon: infoIcon,
        vnode: m(AlertPickerPopover, { label, icon: infoIcon, onSelect: handleAlertSelect }),
        asMenuSub: () => ({
          key: 'bb-info',
          title: label,
          icon: infoIcon,
          renderSub: () => m(AlertPickerPopover, { label, icon: infoIcon, onSelect: handleAlertSelect }),
        }),
      });
    }

    if (on('bb_audio')) {
      const title = app.translator.trans('forumaker-magicbb.forum.composer.audio_button');
      const audioIcon = iconOf('audio', 'fas fa-music');

      const handler = (e) => {
        e?.preventDefault?.();
        const node = el();
        const ed = editor();
        if (!ed?.insertAtCursor) return;

        if (isTiptap(ed)) {
          const [start, end] = ed.getSelectionRange();
          if (start !== end) {
            const selected = getSelectedText(node, ed, start, end).trim();
            replaceRangeUnified(node, ed, start, end, `[audio src=${selected}][/audio]`);
          } else {
            ed.insertAtCursor('[audio src=url][/audio]', true);
          }
          return;
        }

        if (!node) return;
        const hasSelection = node.selectionStart !== node.selectionEnd;
        if (hasSelection) {
          const selected = node.value.slice(node.selectionStart, node.selectionEnd).trim();
          replaceRange(node, node.selectionStart, node.selectionEnd, `[audio src=${selected}][/audio]`);
          return;
        }
        ed.insertAtCursor('[audio src=url][/audio]');
      };

      pool.push({
        key: 'bb-audio',
        prio: 95.25,
        title,
        icon: audioIcon,
        vnode: m(MagicbbBtn, { title, icon: audioIcon, onclick: handler }),
        asMenu: () => ({ key: 'bb-audio', title, icon: audioIcon, onClick: handler }),
      });
    }

    if (on('bb_image')) {
      const label = app.translator.trans('forumaker-magicbb.forum.composer.image_button');
      const imageIcon = iconOf('image', 'fas fa-image');

      const handleImagePick = (align: string) => {
        const node = el();
        const ed = editor();
        if (!ed) return;

        const wrap = (tag: string) => ({ prefix: `[${tag}]`, suffix: `[/${tag}]` });
        const style =
          align === 'left' ? wrap('ileft') : align === 'right' ? wrap('iright') : wrap('icenter');

        if (isTiptap(ed)) {
          const [start, end] = ed.getSelectionRange();
          if (start !== end) {
            const selected = getSelectedText(node, ed, start, end);
            replaceRangeUnified(node, ed, start, end, `${style.prefix}${selected}${style.suffix}`);
          } else {
            ed.insertAtCursor(`${style.prefix}upl-image-preview uuid${style.suffix}`, true);
          }
          return;
        }

        if (!node) return;
        const hasSelection = node.selectionStart !== node.selectionEnd;

        if (hasSelection) {
          styleSelectedText(node, style);
          return;
        }

        const found = findFoFTagAroundSelection(node);
        if (found) {
          const replacement = `${style.prefix}${found.text}${style.suffix}`;
          replaceRange(node, found.start, found.end, replacement);
          return;
        }

        ed.insertAtCursor(`${style.prefix}upl-image-preview uuid${style.suffix}`);
      };

      pool.push({
        key: 'bb-image',
        prio: 95,
        title: label,
        icon: imageIcon,
        vnode: m(ImageAlignPopover, { label, icon: imageIcon, onPick: handleImagePick }),
        asMenuSub: () => ({
          key: 'bb-image',
          title: label,
          icon: imageIcon,
          renderSub: () => m(ImageAlignPopover, { label, icon: imageIcon, onPick: handleImagePick }),
        }),
      });
    }

    if (on('bb_hide_login')) {
      addWrapBlockBtn(
        'bb-hide-login',
        iconOf('hide_login', 'fas fa-sign-in-alt'),
        app.translator.trans('forumaker-magicbb.forum.composer.hide_login_button'),
        'login',
        94
      );
    }

    if (on('bb_hide_reply')) {
      addWrapBlockBtn(
        'bb-hide-reply',
        iconOf('hide_reply', 'fas fa-reply'),
        app.translator.trans('forumaker-magicbb.forum.composer.hide_reply_button'),
        'reply',
        93
      );
    }

    if (on('bb_hide_like')) {
      addWrapBlockBtn(
        'bb-hide-like',
        iconOf('hide_like', 'fas fa-heart'),
        app.translator.trans('forumaker-magicbb.forum.composer.hide_like_button'),
        'like',
        92
      );
    }

    if (on('bb_anchor')) {
      const anchorTitle = app.translator.trans('forumaker-magicbb.forum.composer.anchor_button');
      const anchorIcon  = iconOf('anchor', 'fas fa-anchor');
      const anchorHandler = (e: any) => {
        e?.preventDefault?.();
        const node = el();
        const ed   = editor();
        if (!ed?.insertAtCursor) return;
        if (isTiptap(ed)) {
          ed.insertAtCursor('[anchor=name]', true);
        } else {
          if (!node) return;
          ed.insertAtCursor('[anchor=name]');
        }
      };
      pool.push({
        key: 'bb-anchor',
        prio: 91,
        title: anchorTitle,
        icon: anchorIcon,
        vnode: m(MagicbbBtn, { title: anchorTitle, icon: anchorIcon, onclick: anchorHandler }),
        asMenu: () => ({ key: 'bb-anchor', title: anchorTitle, icon: anchorIcon, onClick: anchorHandler }),
      });

      addBtn(
        'bb-jump',
        iconOf('jump', 'fas fa-hashtag'),
        app.translator.trans('forumaker-magicbb.forum.composer.jump_button'),
        { prefix: '[jump=name]', suffix: '[/jump]' },
        90,
        'Link text'
      );
    }

    pool.sort((a, b) => b.prio - a.prio);

    if (grouped) {
      const menuItems = pool.map((p) => ('asMenuSub' in p ? p.asMenuSub() : p.asMenu()));

      const moreIcon = iconOf('more', 'fas fa-wand-sparkles');

      items.add(
        'bb-more',
        m(MoreButtonsPopover, {
          items: menuItems,
          label: app.translator.trans('forumaker-magicbb.forum.composer.more_button'),
          icon: moreIcon,
        }),
        120
      );
    } else {
      pool.forEach((b) => items.add(b.key, b.vnode, b.prio));
    }
  });
});

app.initializers.add('forumaker-magicbb-live-reveal', () => {
  // Track in-flight refetches so overlapping saves don't trigger duplicate
  // requests for the same post.
  const pending = new Set<string>();

  // Batch every post that needs re-rendering into a single request instead of
  // firing one GET per gated post visible in the DOM.
  function refetchPosts(ids: string[]) {
    const toFetch = ids.filter((id) => !pending.has(id));
    if (!toFetch.length) return;

    toFetch.forEach((id) => pending.add(id));
    app.store
      .find('posts', { filter: { id: toFetch.join(',') } })
      .then(() => m.redraw())
      .catch(() => {})
      .finally(() => toFetch.forEach((id) => pending.delete(id)));
  }

  // Hook Post.prototype.save directly instead of the app-wide request pipeline:
  // likes and replies both resolve through a Post model save, so this only reacts
  // to post-related traffic rather than every API call (search, notifications,
  // user updates, etc). The refetch fires as soon as the save promise resolves —
  // the server has already committed the change by then, so no artificial delay
  // is needed.
  extend(Post.prototype, 'save', function (this: any, result: Promise<any>) {
    result?.then?.(() => {
      const id = this.id ? String(this.id()) : null;
      if (!id) return;

      const ids = new Set<string>();

      // The post that was just liked may need its own hidden content re-rendered.
      if (document.querySelector(`[data-id="${id}"] .bb-hide`)) {
        ids.add(id);
      }

      // A new reply can unlock [reply]-gated content on other visible posts.
      document.querySelectorAll('[data-id] .bb-hide--reply').forEach((el) => {
        const pid = el.closest('[data-id]')?.getAttribute('data-id');
        if (pid) ids.add(pid);
      });

      if (ids.size) refetchPosts(Array.from(ids));
    });
  });
});

app.initializers.add('forumaker-magicbb-anchor-scroll', () => {
  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      const link = (e.target as Element).closest('a.bb-jump') as HTMLAnchorElement | null;
      if (!link) return;

      const href = link.getAttribute('href') ?? '';
      if (!href.startsWith('#magicbb-')) return;

      e.preventDefault();
      e.stopPropagation();

      const anchor = document.getElementById(href.slice(1));
      if (anchor) {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    true
  );
});