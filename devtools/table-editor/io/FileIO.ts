/**
 * FileIO - Handles importing and exporting table geometry files
 *
 * Supported formats:
 * - .physics.json - Raw PhysicsJson geometry
 * - .railrush-table - Bundled table with metadata
 */

export interface RailrushTableBundle {
  version: string;
  type: 'railrush-table';
  table: {
    id: string;
    name: string;
    linkedSkinId: string | null;
    physicsJson: unknown;
  };
}

export interface ImportResult {
  type: 'physics-json' | 'railrush-table';
  name: string;
  linkedSkinId: string | null;
  physicsJson: unknown;
}

/**
 * Parse imported file content and extract table data
 */
export function parseImportedFile(content: string, filename: string): ImportResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  // Check if it's raw PhysicsJson
  const isPhysicsJson = obj.playArea && obj.pockets && obj.rails;
  if (isPhysicsJson) {
    return {
      type: 'physics-json',
      name: filename.replace(/\.[^/.]+$/, ''),
      linkedSkinId: null,
      physicsJson: parsed,
    };
  }

  // Check if it's a railrush-table bundle
  if (obj.type === 'railrush-table') {
    const table = obj.table as Record<string, unknown> | undefined;
    if (table?.physicsJson) {
      return {
        type: 'railrush-table',
        name: (table.name as string) || filename.replace(/\.[^/.]+$/, ''),
        linkedSkinId: (table.linkedSkinId as string) ?? null,
        physicsJson: table.physicsJson,
      };
    }
  }

  return null;
}

/**
 * Open a file picker and read the selected file
 */
export function pickAndReadFile(accept: string = '.json,.railrush-table,.physics.json'): Promise<{ content: string; filename: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const content = await file.text();
        resolve({ content, filename: file.name });
      } catch {
        resolve(null);
      }
    };

    // Handle cancel
    input.oncancel = () => resolve(null);

    input.click();
  });
}

/**
 * Export table data as a downloadable file
 */
export function exportTableAsFile(options: {
  id: string;
  name: string;
  linkedSkinId: string | null;
  physicsJson: unknown;
}): void {
  const bundle: RailrushTableBundle = {
    version: '1.0',
    type: 'railrush-table',
    table: {
      id: options.id,
      name: options.name,
      linkedSkinId: options.linkedSkinId,
      physicsJson: options.physicsJson,
    },
  };

  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.name.replace(/[^\w\-]+/g, '_')}.railrush-table`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Setup drag-and-drop file handling on an element
 */
export function setupDragDrop(
  element: HTMLElement,
  onFile: (content: string, filename: string) => void
): () => void {
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    element.classList.add('drag-over');
  };

  const handleDragLeave = () => {
    element.classList.remove('drag-over');
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    element.classList.remove('drag-over');

    const file = e.dataTransfer?.files[0];
    if (!file) return;

    try {
      const content = await file.text();
      onFile(content, file.name);
    } catch {
      // Ignore read errors
    }
  };

  element.addEventListener('dragover', handleDragOver);
  element.addEventListener('dragleave', handleDragLeave);
  element.addEventListener('drop', handleDrop);

  // Return cleanup function
  return () => {
    element.removeEventListener('dragover', handleDragOver);
    element.removeEventListener('dragleave', handleDragLeave);
    element.removeEventListener('drop', handleDrop);
  };
}
