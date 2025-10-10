// Loading screen with progress bar
export class LoadingScreen {
  private container: HTMLElement;
  private progressBar!: HTMLElement;
  private progressText!: HTMLElement;
  private statusText!: HTMLElement;

  constructor() {
    this.container = this.createLoadingScreen();
    document.body.appendChild(this.container);
  }

  private createLoadingScreen(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'loading-screen';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: 'Courier New', monospace;
      color: #e0e0e0;
    `;

    // Title
    const title = document.createElement('h1');
    title.textContent = '🎱 Pool 2D';
    title.style.cssText = `
      font-size: 48px;
      margin-bottom: 20px;
      color: #4CAF50;
      text-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
    `;
    container.appendChild(title);

    // Status text
    this.statusText = document.createElement('div');
    this.statusText.textContent = 'Loading assets...';
    this.statusText.style.cssText = `
      font-size: 16px;
      margin-bottom: 20px;
      color: #b0b0b0;
    `;
    container.appendChild(this.statusText);

    // Progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 400px;
      height: 30px;
      background: #2a2a2a;
      border: 2px solid #4a4a4a;
      border-radius: 15px;
      overflow: hidden;
      position: relative;
      margin-bottom: 10px;
    `;

    // Progress bar fill
    this.progressBar = document.createElement('div');
    this.progressBar.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%);
      transition: width 0.3s ease;
      box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
    `;
    progressContainer.appendChild(this.progressBar);

    container.appendChild(progressContainer);

    // Progress text
    this.progressText = document.createElement('div');
    this.progressText.textContent = '0%';
    this.progressText.style.cssText = `
      font-size: 14px;
      color: #4CAF50;
      font-weight: bold;
    `;
    container.appendChild(this.progressText);

    return container;
  }

  updateProgress(loaded: number, total: number, status?: string) {
    const percent = Math.round((loaded / total) * 100);
    this.progressBar.style.width = `${percent}%`;
    this.progressText.textContent = `${percent}%`;
    
    if (status) {
      this.statusText.textContent = status;
    }
  }

  hide() {
    this.container.style.opacity = '0';
    this.container.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
      this.container.remove();
    }, 500);
  }
}
