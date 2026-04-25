import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import TextEditorButton from 'flarum/common/components/TextEditorButton';
import styleSelectedText from 'flarum/common/utils/styleSelectedText';

import ColorPalettePopover, { DEFAULT_COLORS } from './components/ColorPalettePopover';
import AlertPickerPopover from './components/AlertPickerPopover';
import ImageAlignPopover from './components/ImageAlignPopover';
import MoreButtonsPopover from './components/MoreButtonsPopover';

const originalWarn = console.warn;
console.warn = function (...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes("Don't reuse attrs object")) {
    return;
  }
  originalWarn.apply(console, args);
};

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
        if (!node || !ed) return;

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
        vnode: m(TextEditorButton, { icon, title, onclick: handler }),
        asMenu: () => ({ key, title, icon, onClick: handler }),
      });
    };

    const addWrapBlockBtn = (key, icon, title, tag, prio) => {
      const handler = (e) => {
        e?.preventDefault?.();
        const node = el();
        if (!node) return;

        const start = node.selectionStart;
        const end = node.selectionEnd;

        if (start === end) {
          const open = `[${tag}]`;
          const close = `[/${tag}]`;
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
        const wrapped = `[${tag}]${selected}[/${tag}]`;
        replaceRange(node, start, end, wrapped);
      };

      pool.push({
        key,
        prio,
        title,
        icon,
        vnode: m(TextEditorButton, { icon, title, onclick: handler }),
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
      const colorPopover = m(ColorPalettePopover, {
        label,
        icon: colorIcon,
        colors: DEFAULT_COLORS,
        onSelect: (hex) => {
          const node = el();
          const ed = editor();
          if (!node || !ed) return;

          const hasSelection = node.selectionStart !== node.selectionEnd;
          const style = { prefix: `[color=${hex}]`, suffix: '[/color]' };

          if (!hasSelection) ed.insertAtCursor(`${style.prefix}Heading${style.suffix}`);
          else styleSelectedText(node, style);
        },
      });

      pool.push({
        key: 'bb-color',
        prio: 98,
        title: label,
        icon: colorIcon,
        vnode: colorPopover,
        asMenuSub: () => ({
          key: 'bb-color',
          title: label,
          icon: colorIcon,
          renderSub: () => colorPopover,
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
        ed.insertAtCursor(tpl);
      };

      pool.push({
        key: 'bb-table',
        prio: 96,
        title,
        icon: tableIcon,
        vnode: m(TextEditorButton, { icon: tableIcon, title, onclick: handler }),
        asMenu: () => ({ key: 'bb-table', title, icon: tableIcon, onClick: handler }),
      });
    }

    if (on('bb_info')) {
      const label = app.translator.trans('forumaker-magicbb.forum.composer.info_button');
      const infoIcon = iconOf('info', 'fas fa-info-circle');
      const alertPopover = m(AlertPickerPopover, {
        label,
        icon: infoIcon,
        onSelect: (a) => {
          const node = el();
          const ed = editor();
          if (!node || !ed) return;

          const hasSelection = node.selectionStart !== node.selectionEnd;
          const tag = a.key;
          const prefix = `[${tag} title=Heading font=${a.font} bg=${a.bg} border=${a.border}]`;
          const suffix = `[/${tag}]`;

          if (!hasSelection) ed.insertAtCursor(`${prefix}Subtitle${suffix}`);
          else styleSelectedText(node, { prefix, suffix });
        },
      });

      pool.push({
        key: 'bb-info',
        prio: 95.5,
        title: label,
        icon: infoIcon,
        vnode: alertPopover,
        asMenuSub: () => ({
          key: 'bb-info',
          title: label,
          icon: infoIcon,
          renderSub: () => alertPopover,
        }),
      });
    }

    if (on('bb_audio')) {
      const title = app.translator.trans('forumaker-magicbb.forum.composer.audio_button') || 'Музыка';
      const audioIcon = iconOf('audio', 'fas fa-music');

      const handler = (e) => {
        e?.preventDefault?.();
        const node = el();
        const ed = editor();
        if (!node || !ed?.insertAtCursor) return;

        const hasSelection = node.selectionStart !== node.selectionEnd;
        if (hasSelection) {
          const selected = node.value.slice(node.selectionStart, node.selectionEnd).trim();
          const tag = `[audio src=${selected}][/audio]`;
          replaceRange(node, node.selectionStart, node.selectionEnd, tag);
          return;
        }

        ed.insertAtCursor('[audio src=url][/audio]');
      };

      pool.push({
        key: 'bb-audio',
        prio: 95.25,
        title,
        icon: audioIcon,
        vnode: m(TextEditorButton, { icon: audioIcon, title, onclick: handler }),
        asMenu: () => ({ key: 'bb-audio', title, icon: audioIcon, onClick: handler }),
      });
    }

    if (on('bb_image')) {
      const label = app.translator.trans('forumaker-magicbb.forum.composer.image_button');
      const imageIcon = iconOf('image', 'fas fa-image');

      const imagePopover = m(ImageAlignPopover, {
        label,
        icon: imageIcon,
        onPick: (align) => {
          const node = el();
          const ed = editor();
          if (!node || !ed) return;

          const wrap = (tag) => ({ prefix: `[${tag}]`, suffix: `[/${tag}]` });
          const style =
            align === 'left' ? wrap('ileft') : align === 'right' ? wrap('iright') : wrap('icenter');

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
        },
      });

      pool.push({
        key: 'bb-image',
        prio: 95,
        title: label,
        icon: imageIcon,
        vnode: imagePopover,
        asMenuSub: () => ({
          key: 'bb-image',
          title: label,
          icon: imageIcon,
          renderSub: () => imagePopover,
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
  function refetchPost(id: string) {
    app.store.find('posts', id).then(() => m.redraw()).catch(() => {});
  }

  const _req = app.request.bind(app);

  (app as any).request = function (options: any) {
    const promise = _req(options);
    const method: string = (options?.method ?? 'GET').toUpperCase();
    const url: string = options?.url ?? '';

    if (method === 'GET') return promise;

    const postMatch = url.match(/\/posts\/(\d+)/);
    if (postMatch) {
      const id = postMatch[1];
      promise?.then?.(() => {
        if (document.querySelector(`[data-id="${id}"] .bb-hide`)) {
          setTimeout(() => refetchPost(id), 250);
        }
      });
    }

    if (method === 'POST' && /\/posts$/.test(url)) {
      promise?.then?.(() => {
        setTimeout(() => {
          document.querySelectorAll('[data-id] .bb-hide--reply').forEach((el) => {
            const id = el.closest('[data-id]')?.getAttribute('data-id');
            if (id) refetchPost(id);
          });
        }, 800);
      });
    }

    return promise;
  };
});