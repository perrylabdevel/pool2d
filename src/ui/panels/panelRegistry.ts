import { PanelManager } from './PanelManager';

export const panelManager = new PanelManager({
  allowMultiple: false,
  closeOnEscape: true,
  storageKey: 'pool2d:ui:last-panel',
  restoreLastOpen: true,
});
