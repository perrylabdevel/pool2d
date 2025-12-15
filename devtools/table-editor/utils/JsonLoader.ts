/**
 * JsonLoader - Load and parse table geometry from physics.json
 * JSON mode only - no fallback geometry
 */

export interface PhysicsJsonPocket {
  id: string;
  center: { x: number; y: number };
  radius: number;
  outline?: { x: number; y: number }[];
}

export interface PhysicsJsonRail {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  normal: { x: number; y: number };
  outline?: { x: number; y: number }[];
}

export interface PhysicsJson {
  meta?: {
    pixelsPerInch?: number;
    source?: string;
    lastModified?: number;
  };
  playArea: {
    width: number;
    height: number;
  };
  pockets: PhysicsJsonPocket[];
  rails: PhysicsJsonRail[];
}

const PHYSICS_JSON_PATH = '/src/geometry/table.physics.json';
const LOCAL_STORAGE_KEY = 'tableEditor.physicsOverride';

export class JsonLoader {
  private cachedJson: PhysicsJson | null = null;

  async load(path: string = PHYSICS_JSON_PATH): Promise<PhysicsJson> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
      }
      
      const json = await response.json();
      let merged = json as PhysicsJson;

      // Apply local override if present
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          const override = JSON.parse(stored) as PhysicsJson;
          merged = { ...json, ...override, meta: { ...json.meta, ...override.meta } };
          console.log('📄 Loaded physics.json override from localStorage');
        } catch (e) {
          console.warn('Failed to parse physics override in localStorage', e);
        }
      }

      this.cachedJson = merged;
      
      console.log('📄 Loaded physics.json:', {
        playArea: merged.playArea,
        pockets: merged.pockets?.length,
        rails: merged.rails?.length,
      });
      
      return merged;
    } catch (err) {
      console.error('Failed to load physics.json:', err);
      throw err;
    }
  }

  getCached(): PhysicsJson | null {
    return this.cachedJson;
  }

  setCached(json: PhysicsJson, persist: boolean = false): void {
    this.cachedJson = json;
    if (persist) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json));
    }
  }

  /**
   * Extract pocket positions from JSON
   */
  getPocketPositions(): { corners: { x: number; y: number }[]; sides: { x: number; y: number }[] } {
    if (!this.cachedJson) {
      return { corners: [], sides: [] };
    }

    const pockets = this.cachedJson.pockets;
    const halfW = this.cachedJson.playArea.width / 2;

    // Side pockets are near x=0, corners are at edges
    const corners = pockets.filter(p => Math.abs(p.center.x) > halfW * 0.25);
    const sides = pockets.filter(p => Math.abs(p.center.x) <= halfW * 0.25);

    return {
      corners: corners.map(p => ({ x: p.center.x, y: p.center.y })),
      sides: sides.map(p => ({ x: p.center.x, y: p.center.y })),
    };
  }

  /**
   * Get all rail segments for rendering
   */
  getRailSegments(): PhysicsJsonRail[] {
    return this.cachedJson?.rails || [];
  }

  /**
   * Get pocket outlines for rendering
   */
  getPocketOutlines(): { id: string; outline: { x: number; y: number }[] }[] {
    if (!this.cachedJson) return [];

    return this.cachedJson.pockets
      .filter(p => p.outline && p.outline.length > 0)
      .map(p => ({
        id: p.id,
        outline: p.outline!,
      }));
  }

  /**
   * Export modified JSON
   */
  exportJson(modifications?: Partial<PhysicsJson>): string {
    const json = {
      ...this.cachedJson,
      ...modifications,
    };
    return JSON.stringify(json, null, 2);
  }
}

export const jsonLoader = new JsonLoader();
