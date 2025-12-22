export interface UploadedImage {
  src: string;  // base64 data URL
  name: string;
  width: number;
  height: number;
}

export class ImageUploader {
  private container: HTMLElement;
  private onUpload: (image: UploadedImage | null) => void;
  private currentImage: UploadedImage | null = null;

  constructor(container: HTMLElement, onUpload: (image: UploadedImage | null) => void) {
    this.container = container;
    this.onUpload = onUpload;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="image-uploader">
        <div class="upload-area" id="upload-drop-zone">
          ${this.currentImage ? this.renderPreview() : this.renderEmpty()}
        </div>
        <input type="file" id="image-file-input" accept="image/*" style="display: none">
      </div>
    `;

    this.bindEvents();
  }

  private renderEmpty(): string {
    return `
      <div class="upload-placeholder">
        <div class="upload-icon">🖼️</div>
        <div class="upload-text">Drop image or click to upload</div>
        <div class="upload-hint">PNG, JPG, WebP</div>
      </div>
    `;
  }

  private renderPreview(): string {
    return `
      <div class="upload-preview">
        <img src="${this.currentImage!.src}" alt="Background preview">
        <button class="upload-clear" title="Remove image">×</button>
        <div class="upload-info">${this.currentImage!.name}</div>
      </div>
    `;
  }

  private bindEvents() {
    const dropZone = this.container.querySelector('#upload-drop-zone') as HTMLElement;
    const fileInput = this.container.querySelector('#image-file-input') as HTMLInputElement;

    // Click to upload
    dropZone.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('upload-clear')) return;
      fileInput.click();
    });

    // File selected
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        this.handleFile(fileInput.files[0]);
      }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        this.handleFile(e.dataTransfer.files[0]);
      }
    });

    // Clear button
    const clearBtn = this.container.querySelector('.upload-clear');
    clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.currentImage = null;
      this.onUpload(null);
      this.render();
    });
  }

  private handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      console.warn('Not an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        this.currentImage = {
          src: dataUrl,
          name: file.name,
          width: img.width,
          height: img.height,
        };
        this.onUpload(this.currentImage);
        this.render();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  setImage(image: UploadedImage | null) {
    this.currentImage = image;
    this.render();
  }
}
