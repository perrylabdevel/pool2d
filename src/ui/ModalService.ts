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
    this.overlay.style.display = 'flex';
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
        this.close();
      }
    });
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
    modal.style.background = 'var(--color-panel-bg)';
    modal.style.borderRadius = '16px';
    modal.style.minWidth = '400px';
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '90vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.boxShadow = 'var(--shadow-elevation-high)';
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
      closeBtn.className = 'modal-close-btn';
      closeBtn.style.background = 'transparent';
      closeBtn.style.border = 'none';
      closeBtn.style.color = '#fff';
      closeBtn.style.fontSize = '28px';
      closeBtn.style.cursor = 'pointer';
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

    // Show overlay
    this.overlay.classList.remove('hidden');
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
}

export const modalService = new ModalService();
