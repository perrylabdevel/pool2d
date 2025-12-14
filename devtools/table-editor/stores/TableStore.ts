/**
 * TableStore - State management for table configuration
 */

export interface TableGeometry {
  playWidth: number;
  playHeight: number;
  cornerThroatWidth: number;
  cornerOffsetX: number;
  cornerOffsetY: number;
  sideThroatWidth: number;
  sideOffsetX: number;
  sideOffsetY: number;
  cornerJawAngle?: number;
  sideJawAngle?: number;
}

export interface TableAppearance {
  feltColor: string;
  frameColor: string;
  railColor: string;
}

export interface TableConfig {
  version: string;
  type: 'table' | 'geometry' | 'skin';
  name: string;
  geometry: TableGeometry;
  appearance?: TableAppearance;
  textures?: {
    felt?: string;
    frame?: string;
    rails?: string;
    pockets?: string;
  };
}

export class TableStore {
  private config: TableConfig;
  private listeners: Set<(config: TableConfig) => void> = new Set();

  constructor() {
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): TableConfig {
    return {
      version: '1.0',
      type: 'table',
      name: 'Untitled',
      geometry: {
        playWidth: 100,
        playHeight: 50,
        cornerThroatWidth: 5.0,
        cornerOffsetX: 0,
        cornerOffsetY: 0,
        sideThroatWidth: 5.5,
        sideOffsetX: 0,
        sideOffsetY: 0,
      },
      appearance: {
        feltColor: '#1a5f2a',
        frameColor: '#4a2810',
        railColor: '#3d2108',
      },
    };
  }

  getConfig(): TableConfig {
    return { ...this.config };
  }

  setConfig(config: TableConfig): void {
    this.config = { ...config };
    this.notify();
  }

  updateGeometry(changes: Partial<TableGeometry>): void {
    this.config.geometry = {
      ...this.config.geometry,
      ...changes,
    };
    this.notify();
  }

  updateAppearance(changes: Partial<TableAppearance>): void {
    this.config.appearance = {
      ...this.config.appearance,
      ...changes,
    };
    this.notify();
  }

  setName(name: string): void {
    this.config.name = name;
    this.notify();
  }

  subscribe(listener: (config: TableConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const config = this.getConfig();
    this.listeners.forEach(listener => listener(config));
  }

  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  fromJSON(json: string): void {
    try {
      const config = JSON.parse(json);
      this.setConfig(config);
    } catch (err) {
      console.error('Failed to parse JSON:', err);
    }
  }
}
