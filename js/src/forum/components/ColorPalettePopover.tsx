import PopoverBase from './PopoverBase';

const DEFAULT_COLORS = [
  '#FF4D4D', '#FF8A3D', '#FFD53D', '#22C55E',
  '#06B6D4', '#3B82F6', '#4F46E5', '#A855F7',
  '#EB8A90', '#DED9E2', '#536873', '#FEFEE3',
  '#2F3437', '#6B3F2B', '#121212', '#7F1D1D',
];

export default class ColorPalettePopover extends PopoverBase {
  view(vnode) {
    const { label, colors = DEFAULT_COLORS, onSelect } = vnode.attrs;
    const icon = vnode.attrs.icon || 'fas fa-palette';

    const trigger = m('button.Button.Button--icon',
      {
        type: 'button',
        'aria-label': label,
        'aria-haspopup': 'dialog',
        'aria-expanded': String(this.isOpen),
        style: 'background:transparent;box-shadow:none;transform:none;',
        onclick: (e) => {
          e.preventDefault();
          this.toggle();
          e.currentTarget.blur();
        },
        oncreate: (v) => (this.anchor = v.dom),
      },
      m('i', { className: `icon ${icon}`, 'aria-hidden': 'true' })
    );

    return m.fragment({ key: 'magicbb-color' }, [
      trigger,
      this.isOpen &&
        m(
          'div.Magicbb-ColorPopover',
          {
            style: this.anchorStyle(),
            oncreate: (v) => (this.popoverEl = v.dom),
            onremove: () => (this.popoverEl = null),
          },
          m(
            'div.Magicbb-ColorGrid',
            (colors || DEFAULT_COLORS).map((hex) =>
              m('button.Magicbb-Color', {
                type: 'button',
                title: hex,
                'aria-label': hex,
                style: `background:${hex}`,
                onclick: (e) => {
                  e.preventDefault();
                  onSelect?.(hex);
                  this.close();
                },
              })
            )
          )
        ),
    ]);
  }
}

export { DEFAULT_COLORS };
