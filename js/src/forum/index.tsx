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

        // Textarea mode — original behaviour
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
        vnode: m(TextEditorButton, { icon, title, onclick: handler }),
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

        // Textarea mode — original behaviour
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
        ed.insertAtCursor(tpl, true);
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
          if (!ed) return;

          const wrap = (tag) => ({ prefix: `[${tag}]`, suffix: `[/${tag}]` });
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