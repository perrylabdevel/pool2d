/**
 * SaveServer - Handles saving tables to disk via the local save server
 *
 * The save server runs alongside the dev server and writes files to the
 * project's assets directory.
 */

const DEFAULT_SAVE_PORT = 8090;
const SAVE_PORT_STORAGE_KEY = 'table-editor-save-port';

export interface SaveTableOptions {
  name: string;
  tableId: string;
  physicsJson: unknown;
  setActive: boolean;
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

/**
 * Get the configured save server port from localStorage
 */
export function getSaveServerPort(): number {
  try {
    const stored = localStorage.getItem(SAVE_PORT_STORAGE_KEY);
    const port = stored ? parseInt(stored, 10) : NaN;
    return Number.isFinite(port) ? port : DEFAULT_SAVE_PORT;
  } catch {
    return DEFAULT_SAVE_PORT;
  }
}

/**
 * Set the save server port in localStorage
 */
export function setSaveServerPort(port: number): void {
  try {
    if (Number.isFinite(port) && port > 0 && port < 65536) {
      localStorage.setItem(SAVE_PORT_STORAGE_KEY, String(port));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Save a table to disk via the save server
 */
export async function saveTableToDisk(options: SaveTableOptions): Promise<SaveResult> {
  const port = getSaveServerPort();
  const url = `http://${window.location.hostname}:${port}/api/table-editor/save`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: options.name,
        tableId: options.tableId,
        physicsJson: options.physicsJson,
        setActive: options.setActive,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }

    return { success: true };
  } catch (err) {
    console.error('Save to disk failed:', err);
    return {
      success: false,
      error: String(err),
    };
  }
}
