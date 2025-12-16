export type EditorAssistSettings = {
  snapEnabled: boolean;
  snapTolerancePx: number;
  snapToGrid: boolean;
  snapToAlign: boolean;
  snapToPlayArea: boolean;
  gridEnabled: boolean;
  gridSpacingIn: number;
  gridMajorEvery: number;
};

export const DEFAULT_EDITOR_ASSIST_SETTINGS: EditorAssistSettings = {
  snapEnabled: true,
  snapTolerancePx: 8,
  snapToGrid: true,
  snapToAlign: true,
  snapToPlayArea: true,
  gridEnabled: false,
  gridSpacingIn: 0.125,
  gridMajorEvery: 8,
};

export function sanitizeEditorAssistSettings(input: any): EditorAssistSettings {
  const asBool = (v: any, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const asNum = (v: any, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

  const snapTolerancePx = Math.max(1, Math.min(64, asNum(input?.snapTolerancePx, DEFAULT_EDITOR_ASSIST_SETTINGS.snapTolerancePx)));
  const gridSpacingIn = Math.max(0.01, Math.min(10, asNum(input?.gridSpacingIn, DEFAULT_EDITOR_ASSIST_SETTINGS.gridSpacingIn)));
  const gridMajorEvery = Math.max(1, Math.min(64, Math.round(asNum(input?.gridMajorEvery, DEFAULT_EDITOR_ASSIST_SETTINGS.gridMajorEvery))));

  return {
    snapEnabled: asBool(input?.snapEnabled, DEFAULT_EDITOR_ASSIST_SETTINGS.snapEnabled),
    snapTolerancePx,
    snapToGrid: asBool(input?.snapToGrid, DEFAULT_EDITOR_ASSIST_SETTINGS.snapToGrid),
    snapToAlign: asBool(input?.snapToAlign, DEFAULT_EDITOR_ASSIST_SETTINGS.snapToAlign),
    snapToPlayArea: asBool(input?.snapToPlayArea, DEFAULT_EDITOR_ASSIST_SETTINGS.snapToPlayArea),
    gridEnabled: asBool(input?.gridEnabled, DEFAULT_EDITOR_ASSIST_SETTINGS.gridEnabled),
    gridSpacingIn,
    gridMajorEvery,
  };
}

