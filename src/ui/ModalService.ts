import { uiSoundService } from './UISoundService';

export interface ModalOptions {
  title?: string;
  content: HTMLElement;
  footer?: HTMLElement;
  onClose?: () => void;
  className?: string;
}

export class ModalService {
  private overlay: HTMLElement;
  private container: HTMLElement;
  private currentModal: HTMLElement | null = null;
  private closeTimeout: number | null = null;
  private onCloseCallback: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'modal-overlay';
    this.overlay.className = 'u-frosted-glass hidden';
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100vw';
    this.overlay.style.height = '100vh';
    this.overlay.style.zIndex = '2000';
    this.overlay.style.display = 'none'; // Start hidden, will be set to 'flex' when shown
    this.overlay.style.alignItems = 'center';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.opacity = '0';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.transition = 'opacity var(--motion-normal)';

    document.body.appendChild(this.overlay);

    this.container = document.createElement('div');
    this.container.id = 'modal-container';
    this.overlay.appendChild(this.container);

    // Bind click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay || e.target === this.container) {
        this.close();
      }
    });

    // Bind escape key to close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentModal) {
        e.preventDefault(); // Prevent default browser behavior
        e.stopImmediatePropagation(); // Prevent other listeners (like InGameMenu) from seeing this
        this.close();
      }
    }, true); // Use capture phase to catch it before bubbling listeners if needed, or just rely on order.
    // Actually, standard bubbling order: Document -> Body. If we bind to window, we are at the top.
    // But InGameMenu also binds to window.
    // To ensure we run BEFORE InGameMenu, we might want capture phase or rely on registration order.
    // Since ModalService is likely instantiated before InGameMenu (it's a dependency), its listener might run first if order is preserved.
    // However, 'stopImmediatePropagation' only works if we are on the same element and running first, or capturing.
    // Let's use capture phase {capture: true} to ensure we get it first.
  }

  show(options: ModalOptions) {
    // Cancel any pending close operation
    if (this.closeTimeout) {
      window.clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }

    // If we already have a modal, remove it immediately (swap)
    if (this.currentModal) {
      if (this.currentModal.parentNode === this.container) {
        this.container.removeChild(this.currentModal);
      }
      // If we had a previous callback that hasn't fired, fire it now as we are closing that modal
      // actually, no, swapping modals shouldn't necessarily trigger the 'close' logic of the previous one
      // unless we consider swapping a 'close' event.
      // But typically 'close' implies finishing interaction.
      // Let's play it safe: we don't fire the old callback on swap, assuming the new modal
      // is part of the same flow or the caller handled it.
      this.currentModal = null;
      this.onCloseCallback = null;
    }

    this.onCloseCallback = options.onClose || null;

    const modal = document.createElement('div');
    modal.className = `modal-shell u-metallic-border ${options.className || ''}`;
    // Sizing/layout handled by CSS .modal-shell now
    modal.style.transform = 'scale(0.9)';
    modal.style.transition = 'transform var(--motion-bounce)';

    // Header
    if (options.title) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      header.style.padding = '20px 24px';
      header.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';

      const title = document.createElement('h2');
      title.className = 'u-font-heading u-chrome-text';
      title.textContent = options.title;
      title.style.fontSize = '24px';
      title.style.margin = '0';

      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.className = 'btn-arcade-icon';
      closeBtn.onclick = () => this.close();

      header.appendChild(title);
      header.appendChild(closeBtn);
      modal.appendChild(header);
    }

    // Content
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.padding = '24px';
    content.style.overflowY = 'auto';
    content.appendChild(options.content);
    modal.appendChild(content);

    // Footer
    if (options.footer) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      footer.style.padding = '20px 24px';
      footer.style.borderTop = '1px solid rgba(255,255,255,0.1)';
      footer.appendChild(options.footer);
      modal.appendChild(footer);
    }

    this.container.appendChild(modal);
    this.currentModal = modal;
    uiSoundService.play('modal-open');

    // Show overlay
    this.overlay.classList.remove('hidden');
    this.overlay.style.display = 'flex';
    // Trigger reflow
    this.overlay.offsetHeight;
    this.overlay.style.opacity = '1';
    this.overlay.style.pointerEvents = 'all';

    // Animate modal
    requestAnimationFrame(() => {
      modal.style.transform = 'scale(1)';
    });
  }

  close() {
    if (!this.currentModal) return;

    const modal = this.currentModal;
    modal.style.transform = 'scale(0.9)';
    this.overlay.style.opacity = '0';
    this.overlay.style.pointerEvents = 'none';

    if (this.closeTimeout) {
        window.clearTimeout(this.closeTimeout);
    }

    this.closeTimeout = window.setTimeout(() => {
      if (modal.parentNode === this.container) {
        this.container.removeChild(modal);
      }
      
      // Only clear state if this is still the active modal
      if (this.currentModal === modal) {
          this.currentModal = null;
          this.overlay.classList.add('hidden');
          this.overlay.style.display = 'none';
          uiSoundService.play('modal-close');
          if (this.onCloseCallback) {
              this.onCloseCallback();
              this.onCloseCallback = null;
          }
      }
      this.closeTimeout = null;
    }, 300); // Match transition duration
  }

  isOpen(): boolean {
      return !!this.currentModal;
  }

  confirm(options: { title: string; message: string; confirmText?: string; cancelText?: string; onConfirm: () => void }) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '20px';
    container.style.padding = '10px 0';
    container.style.textAlign = 'center';

    const msg = document.createElement('p');
    msg.textContent = options.message;
    msg.style.fontSize = '16px';
    msg.style.color = 'rgba(255,255,255,0.8)';
    msg.style.lineHeight = '1.5';
    container.appendChild(msg);

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '12px';
    footer.style.justifyContent = 'center';
    footer.style.width = '100%';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = options.cancelText || 'Cancel';
    cancelBtn.className = 'btn-arcade btn-arcade-glass';
    cancelBtn.style.flex = '1';
    cancelBtn.onclick = () => this.close();

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = options.confirmText || 'Confirm';
    confirmBtn.className = 'btn-arcade btn-arcade-danger'; // Default to danger for confirmations usually (destructive)
    confirmBtn.style.flex = '1';
    confirmBtn.onclick = () => {
        options.onConfirm();
        this.close();
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    this.show({
        title: options.title,
        content: container,
        footer: footer,
        className: 'confirm-modal' // Specific class for sizing overrides if needed
    });
    
    // Override size for confirm modals to be smaller
    if (this.currentModal) {
        this.currentModal.style.minWidth = '300px';
        this.currentModal.style.width = '400px';
        this.currentModal.style.height = 'auto';
    }
  }
}

export const modalService = new ModalService();
