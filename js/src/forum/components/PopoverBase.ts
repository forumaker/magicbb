import Component from 'flarum/common/Component';

/**
 * Shared open/close lifecycle for the toolbar popovers.
 *
 * Handles document-level "click outside" and Escape listeners, and positions
 * the popover above its trigger. Subclasses only render the trigger and the
 * popover body, and call toggle() / close().
 */
export default abstract class PopoverBase extends Component {
  protected isOpen: boolean = false;
  protected anchor: HTMLElement | null = null;
  protected popoverEl: HTMLElement | null = null;

  private onDocClick = (e: MouseEvent): void => {
    if (!this.isOpen) return;

    const target = e.target as Node | null;
    if (!target || !this.popoverEl) return;

    if (!this.popoverEl.contains(target) && !this.anchor?.contains(target)) {
      this.close();
    }
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  onremove() {
    this.detachListeners();
  }

  protected open(): void {
    if (this.isOpen) return;

    this.isOpen = true;
    document.addEventListener('mousedown', this.onDocClick);
    document.addEventListener('keydown', this.onKey);
  }

  protected close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.detachListeners();
    m.redraw();
  }

  protected toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  /**
   * Fixed-position style placing the popover centred above the trigger.
   */
  protected anchorStyle(): Record<string, string> | null {
    if (!this.isOpen || !this.anchor) return null;

    const r = this.anchor.getBoundingClientRect();

    return {
      position: 'fixed',
      left: `${r.left + r.width / 2}px`,
      top: `${r.top}px`,
      transform: 'translate(-50%, calc(-100% - 8px))',
    };
  }

  private detachListeners(): void {
    document.removeEventListener('mousedown', this.onDocClick);
    document.removeEventListener('keydown', this.onKey);
  }
}
