import { CueEditorApp } from './CueEditorApp';

const app = new CueEditorApp();
window.addEventListener('DOMContentLoaded', () => {
  app.init().catch(err => {
    console.error('Failed to init CueEditorApp:', err);
  });
});
