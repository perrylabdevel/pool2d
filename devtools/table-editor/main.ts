/**
 * Table Editor - Main Entry Point
 * Standalone devtool for managing pool table configurations in JSON mode
 */

import { TableEditorApp } from './TableEditorApp';

// Initialize the editor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new TableEditorApp();
  app.init();
  
  // Expose for debugging
  (window as any).tableEditor = app;
});
