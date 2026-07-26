// Loading screen. Markup only — every color, radius and duration comes from
// styles/theme.css so this matches the rest of the product.

export class LoadingScreen {
  private container: HTMLElement;
  private fill: HTMLElement;
  private status: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'loading-screen';
    this.container.innerHTML = `
      <div class="loading-inner">
        <div class="loading-title">Midnight</div>
        <div class="loading-sub">Pool Hall</div>
        <div class="loading-track"><div class="loading-fill"></div></div>
        <div class="loading-status">Racking up…</div>
      </div>
    `;

    this.fill = this.container.querySelector('.loading-fill')!;
    this.status = this.container.querySelector('.loading-status')!;

    document.body.appendChild(this.container);
  }

  updateProgress(loaded: number, total: number, status?: string) {
    const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
    this.fill.style.width = `${percent}%`;
    if (status) this.status.textContent = status;
  }

  hide() {
    this.container.classList.add('fade-out');
    // Matches --dur-slow; harmless if motion is reduced, the node just leaves late.
    setTimeout(() => this.container.remove(), 420);
  }
}
