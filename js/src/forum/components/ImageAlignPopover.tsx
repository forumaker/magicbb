import PopoverBase from './PopoverBase';

const CHOICES = [
  { key: 'left',   icon: 'fas fa-align-left',   title: 'Left' },
  { key: 'center', icon: 'fas fa-align-center', title: 'Center' },
  { key: 'right',  icon: 'fas fa-align-right',  title: 'Right' },
];

export default class ImageAlignPopover extends PopoverBase {
  view(vnode) {
    const label = vnode.attrs.label || 'Image';
    const onPick = vnode.attrs.onPick || function () {};
    const icon = vnode.attrs.icon || 'fas fa-images';

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
        oncreate: (v) => { this.anchor = v.dom; },
      },
      m('i', { className: 'icon ' + icon, 'aria-hidden': 'true' })
    );

    const popover = this.isOpen
      ? m('div.Magicbb-ImagePopover',
          {
            style: this.anchorStyle(),
            oncreate: (v) => { this.popoverEl = v.dom; },
            onremove: () => { this.popoverEl = null; },
          },
          m('div.Magicbb-ImageGrid',
            CHOICES.map((c) =>
              m(
                'button.Magicbb-ImageChoice',
                {
                  type: 'button',
                  title: c.title,
                  'aria-label': c.title,
                  onclick: (e) => {
                    e.preventDefault();
                    onPick(c.key);
                    this.close();
                  },
                },
                m('i', { className: 'icon ' + c.icon, 'aria-hidden': 'true' })
              )
            )
          )
        )
      : null;

    return [trigger, popover];
  }
}
