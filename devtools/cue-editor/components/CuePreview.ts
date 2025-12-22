import { CueSkin } from '../stores/CueStore';

export class CuePreview {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private skin: CueSkin | null = null;
  private image: HTMLImageElement | null = null;
  
  // View State
  private panX = 0;
  private panY = 0;
  private zoom = 1.0;
  
  // Interaction State
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    const resizeObserver = new ResizeObserver(() => this.fitCanvas());
    resizeObserver.observe(canvas.parentElement!);
    this.fitCanvas();
    
    this.setupInteraction();
  }

  private fitCanvas() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
      this.draw();
    }
  }

  private setupInteraction() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.panX += dx;
      this.panY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.draw();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newZoom = Math.max(0.1, Math.min(10, this.zoom * (1 + delta)));
      
      // Zoom towards mouse pointer
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate mouse pos in world space before zoom
      const worldX = (mouseX - this.canvas.width / 2 - this.panX) / this.zoom;
      const worldY = (mouseY - this.canvas.height / 2 - this.panY) / this.zoom;

      this.zoom = newZoom;

      // Adjust pan to keep world point under mouse
      this.panX = mouseX - this.canvas.width / 2 - worldX * this.zoom;
      this.panY = mouseY - this.canvas.height / 2 - worldY * this.zoom;

      this.draw();
    });
  }

  resetView() {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    // Fit image if loaded
    if (this.image) {
      const fitScale = Math.min(
        (this.canvas.width * 0.8) / this.image.width,
        (this.canvas.height * 0.8) / this.image.height
      );
      if (fitScale < 1) this.zoom = fitScale;
    }
    this.draw();
  }

  async loadSkin(skin: CueSkin) {
    this.skin = skin;
    if (!skin.imageBase64) {
      this.image = null;
      this.draw();
      return;
    }

    this.image = new Image();
    this.image.src = skin.imageBase64;
    await new Promise<void>((resolve) => {
      this.image!.onload = () => resolve();
      this.image!.onerror = () => {
        this.image = null;
        resolve();
      };
    });
    // Optional: auto-fit on load? Maybe just redraw.
    this.draw();
  }

  clear() {
    this.skin = null;
    this.image = null;
    this.draw();
  }

  draw() {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // Clear
    ctx.fillStyle = '#11111b';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    
    // Apply View Transform
    // Origin is center of screen
    ctx.translate(width / 2 + this.panX, height / 2 + this.panY);
    ctx.scale(this.zoom, this.zoom);

    // Draw Infinite Grid
    this.drawGrid(ctx, width, height);

    // Draw Axes (World Origin)
    ctx.strokeStyle = '#585b70';
    ctx.lineWidth = 1 / this.zoom;
    ctx.beginPath();
    ctx.moveTo(-10000, 0);
    ctx.lineTo(10000, 0);
    ctx.moveTo(0, -10000);
    ctx.lineTo(0, 10000);
    ctx.stroke();

    // Draw Content
    if (this.skin && this.image) {
      this.drawSkin(ctx);
    }

    ctx.restore();

    // HUD / Overlay (Static)
    this.drawOverlay(ctx);
  }

  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Calculate visible world bounds to optimize grid drawing
    const left = -(width / 2 + this.panX) / this.zoom;
    const right = (width / 2 - this.panX) / this.zoom;
    const top = -(height / 2 + this.panY) / this.zoom;
    const bottom = (height / 2 - this.panY) / this.zoom;

    const gridSize = 50;
    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;

    ctx.strokeStyle = '#313244';
    ctx.lineWidth = 1 / this.zoom;
    ctx.beginPath();

    for (let x = startX; x < right; x += gridSize) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = startY; y < bottom; y += gridSize) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
  }

  private drawSkin(ctx: CanvasRenderingContext2D) {
    if (!this.image || !this.skin) return;

    // Draw image such that (0,0) is the "Contact Point" (Tip).
    // The tipOffsetPx in the skin defines where the tip is relative to the *top/left* of the image?
    // In our previous implementation, we assumed tipOffsetPx was an X offset from the left.
    // "Image starts at cx - offsetPxScaled" -> implies tip is at +offsetPx from left of image.
    
    // So if Image is drawn at (x, y), Tip is at (x + offset, y + height/2).
    // We want Tip at (0,0).
    // So Image X = -offset.
    // Image Y = -height/2.

    const img = this.image;
    // We draw at 1:1 scale in world space, the view zoom handles the rest.
    
    // NOTE: In game, lengthScale/thicknessScale are applied. 
    // Here we visualize the raw asset. Maybe we can show a bounding box for the "physically scaled" version?
    
    const drawX = -(this.skin.tipOffsetPx ?? 0);
    const drawY = -img.height / 2;

    ctx.save();
    
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10 / this.zoom;
    ctx.shadowOffsetY = 5 / this.zoom;
    
    ctx.drawImage(img, drawX, drawY);
    ctx.restore();

    // Outline
    ctx.strokeStyle = '#89b4fa';
    ctx.lineWidth = 1 / this.zoom;
    ctx.strokeRect(drawX, drawY, img.width, img.height);

    // Tip Marker (Fixed at World 0,0)
    ctx.strokeStyle = '#f38ba8';
    ctx.lineWidth = 2 / this.zoom;
    ctx.beginPath();
    ctx.moveTo(0, -img.height); // Draw a vertical line through the tip
    ctx.lineTo(0, img.height);
    ctx.stroke();
  }

  private drawOverlay(ctx: CanvasRenderingContext2D) {
    // Debug info in corner
    ctx.fillStyle = '#cdd6f4';
    ctx.font = '11px sans-serif';
    if (this.image) {
      ctx.fillText(`Image: ${this.image.width}x${this.image.height} px`, 10, this.canvas.height - 10);
      ctx.fillText(`Zoom: ${(this.zoom * 100).toFixed(0)}%`, 10, this.canvas.height - 25);
    }
  }
}