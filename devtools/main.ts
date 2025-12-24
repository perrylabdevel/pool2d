import { GeometryPanel } from '../src/ui/GeometryPanel';
import { ModernGeometryPanel } from '../src/ui/ModernGeometryPanel';
import { RenderLayerPanel } from '../src/ui/RenderLayerPanel';
import { RemoteSettingsManager } from './RemoteSettingsManager';
import { Renderer3D } from '../src/render/Renderer3D'; // We might need a mock or a remote proxy for this

// Mock Renderer for RenderLayerPanel since it expects a Renderer3D
// In a real decoupled system, we'd have a RemoteRendererProxy
class MockRenderer {
    tableRenderer = {
        regenerateTextures: () => {
            console.log('Sending regenerateTextures command');
            // This will be handled by RemoteSettingsManager or a separate command channel
            // For now, we can hack it or add a method to RemoteSettingsManager
            (window as any).settingsManager.sendCommand('regenerateTextures');
        }
    };

    setBallScale() { }
    applyRenderLayerSettings() { }
    setLightingIntensities() { }
    setRailShadowSpread() { }
    setRailShadowSoftness() { }
    setRailShadowBaseGray() { }
    setRailHighlightSpread() { }
    setRailHighlightColor() { }
    setHighlightIntensities() { }
    setPocketGrooveSettings() { }
    setPocketShadeColors() { }
    setPocketGradientStrength() { }
    getRenderLayerSettings() { return {}; }
    getLightingIntensities() { return {}; }
    getHighlightIntensities() { return {}; }
    getReferenceOverlayVisible() { return false; }
}

const settingsManager = new RemoteSettingsManager();
(window as any).settingsManager = settingsManager;

import { AudioPanel } from '../src/ui/AudioPanel';
import { GameSettingsPanel } from '../src/ui/GameSettingsPanel';
import { PhysicsPanel } from './src/ui/PhysicsPanel';
import { IOSBuildPanel } from './src/ui/IOSBuildPanel';
import { RulesPanel } from './src/ui/RulesPanel';

// Initialize panels
const mockRenderer = new MockRenderer(); // Define mockRenderer once

const geometryPanel = new GeometryPanel(settingsManager as any, () => {
    // On change callback
    console.log('Geometry changed in panel');
});

const modernGeometryPanel = new ModernGeometryPanel(settingsManager as any, () => {
    console.log('Modern Geometry changed in panel');
});

const renderLayerPanel = new RenderLayerPanel(settingsManager as any, mockRenderer as any);

const audioPanel = new AudioPanel(settingsManager as any);
const gameSettingsPanel = new GameSettingsPanel(settingsManager as any);
const physicsPanel = new PhysicsPanel(settingsManager as any);
const iosBuildPanel = new IOSBuildPanel(settingsManager as any);
const rulesPanel = new RulesPanel(settingsManager as any);

import { PlaybackPanel } from './src/ui/PlaybackPanel';
const playbackPanel = new PlaybackPanel(() => { });
playbackPanel.getController().open();

// Force panels open
geometryPanel.open();
modernGeometryPanel.open();
renderLayerPanel.open();
audioPanel.getController().open();
gameSettingsPanel.getController().open();
physicsPanel.getController().open();
iosBuildPanel.getController().open();
rulesPanel.getController().open();

// Handle connection status
const statusEl = document.getElementById('connection-status');
settingsManager.addEventListener('connected', () => {
    if (statusEl) {
        statusEl.textContent = 'Connected';
        statusEl.className = 'status-connected';
    }
});

settingsManager.addEventListener('disconnected', () => {
    if (statusEl) {
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'status-disconnected';
    }
});
