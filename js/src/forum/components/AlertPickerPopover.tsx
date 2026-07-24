import PopoverBase from './PopoverBase';

const ALERTS = [
  { key: 'info',    icon: 'fas fa-circle-info',          font: '#1E2019', bg: '#B8D3D1', border: '#B8D3D1' },
  { key: 'success', icon: 'fas fa-check',               font: '#1E2019', bg: '#A9C7AA', border: '#A9C7AA' },
  { key: 'warning', icon: 'fas fa-triangle-exclamation',font: '#1E2019', bg: '#F6D0B1', border: '#F6D0B1' },
  { key: 'error',   icon: 'fas fa-xmark',               font: '#1E2019', bg: '#DF817C', border: '#DF817C' },
];

export default class AlertPickerPopover extends PopoverBase {
  view(vnode) {
    const { label, onSelect } = vnode.attrs;
    const icon = vnode.attrs.icon || 'fas fa-circle-exclamation';

    const trigger = m('button.Button.Button--icon',
      {
        type: 'button',
        'aria-label': label,
        'aria-haspopup': 'dialog',
        'aria-expanded': String(this.isOpen),
        style: 'background:transparent;box-shadow:none;transform:none;',
        onclick: (e) => { e.preventDefault(); this.toggle(); e.currentTarget.blur(); },
        oncreate: (v) => (this.anchor = v.dom),
      },
      m('i', { className: `icon ${icon}`, 'aria-hidden': 'true' })
    );

    return m.fragment({ key: 'magicbb-alert' }, [
      trigger,
      this.isOpen &&
        m('div.Magicbb-AlertPopover',
          {
            style: this.anchorStyle(),
            oncreate: (v) => (this.popoverEl = v.dom),
            onremove: () => (this.popoverEl = null),
          },
          m('div.Magicbb-AlertGrid',
            ALERTS.map((a) =>
              m('button.Magicbb-AlertChoice',
                {
                  type: 'button',
                  title: a.key,
                  'aria-label': a.key,
                  style: `background:${a.bg}`,
                  onclick: (e) => { e.preventDefault(); onSelect?.(a); this.close(); },
                },
                m('i', { className: `icon ${a.icon}`, 'aria-hidden': 'true', style: 'color:#fff' })
              )
            )
          )
        ),
    ]);
  }
}

export { ALERTS };
