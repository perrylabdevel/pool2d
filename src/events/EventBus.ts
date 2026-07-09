/**
 * Typed Event Bus for RailRush
 * 
 * Replaces scattered window.dispatchEvent/addEventListener calls with
 * a centralized, type-safe event system.
 * 
 * Usage:
 *   import { eventBus, GameEvents } from './events/EventBus';
 *   
 *   // Subscribe
 *   const unsubscribe = eventBus.on(GameEvents.RESTART, () => { ... });
 *   
 *   // Emit
 *   eventBus.emit(GameEvents.RESTART);
 *   
 *   // Cleanup
 *   unsubscribe();
 */

import type { AudioSettings, GameSettings, PhysicsSettings, GeometrySettings, RenderSettings, UIColors, TableAppearance } from '../ui/SettingsManager';
import type { ModernPocketGeometry } from '../geometry/ModernGeometry';
import type { UIState, TransitionType } from '../ui/UIStateMachine';

// ============================================================================
// Event Names (Constants)
// ============================================================================

export const GameEvents = {
  // Core game lifecycle
  RESTART: 'game:restart',
  PAUSE: 'game:pause',
  RESUME: 'game:resume',
  DEBUG_TOGGLE: 'game:debug-toggle',
  
  // Match events
  MATCH_RECORDED: 'match:recorded',
  MATCH_START: 'match:start',
  MATCH_END: 'match:end',
} as const;

export const SettingsEvents = {
  // Settings category changes
  GAME_CHANGED: 'settings:game-changed',
  AUDIO_CHANGED: 'settings:audio-changed',
  PHYSICS_CHANGED: 'settings:physics-changed',
  GEOMETRY_CHANGED: 'settings:geometry-changed',
  MODERN_GEOMETRY_CHANGED: 'settings:modern-geometry-changed',
  RENDER_CHANGED: 'settings:render-changed',
  UI_COLORS_CHANGED: 'settings:ui-colors-changed',
  COLORS_CHANGED: 'settings:colors-changed', // Legacy alias
  APPEARANCE_CHANGED: 'settings:appearance-changed',
  TEXTURE_CHANGED: 'settings:texture-changed',
} as const;

export const UIEvents = {
  // UI state machine
  STATE_CHANGED: 'ui:state:changed',
  REQUEST_CONFIRM_EXIT: 'ui:request-confirm-exit',
  
  // Panel events
  PANEL_OPENED: 'ui:panel:opened',
  PANEL_CLOSED: 'ui:panel:closed',
} as const;

export const AudioEvents = {
  PREVIEW: 'audio:preview',
} as const;

// ============================================================================
// Event Payloads (Type Definitions)
// ============================================================================

export interface EventPayloads {
  // Game Events
  [GameEvents.RESTART]: void;
  [GameEvents.PAUSE]: void;
  [GameEvents.RESUME]: void;
  [GameEvents.DEBUG_TOGGLE]: void;
  [GameEvents.MATCH_RECORDED]: { data: unknown };
  [GameEvents.MATCH_START]: { clubId: string; entryFee: number };
  [GameEvents.MATCH_END]: { winner: number; reason: string };
  
  // Settings Events
  [SettingsEvents.GAME_CHANGED]: { settings: GameSettings };
  [SettingsEvents.AUDIO_CHANGED]: { settings: AudioSettings };
  [SettingsEvents.PHYSICS_CHANGED]: { settings: PhysicsSettings };
  [SettingsEvents.GEOMETRY_CHANGED]: { settings: GeometrySettings };
  [SettingsEvents.MODERN_GEOMETRY_CHANGED]: { settings: ModernPocketGeometry };
  [SettingsEvents.RENDER_CHANGED]: { settings: RenderSettings };
  [SettingsEvents.UI_COLORS_CHANGED]: { colors: UIColors };
  [SettingsEvents.COLORS_CHANGED]: { colors: UIColors };
  [SettingsEvents.APPEARANCE_CHANGED]: { appearance: TableAppearance };
  [SettingsEvents.TEXTURE_CHANGED]: void;
  
  // UI Events
  [UIEvents.STATE_CHANGED]: { from: UIState; to: UIState; transition: TransitionType };
  [UIEvents.REQUEST_CONFIRM_EXIT]: { targetState: UIState; onConfirm: () => void };
  [UIEvents.PANEL_OPENED]: { panelId: string };
  [UIEvents.PANEL_CLOSED]: { panelId: string };
  
  // Audio Events
  [AudioEvents.PREVIEW]: { event: string };
}

// Type helper for all event names
export type EventName = keyof EventPayloads;

// Type helper for event handlers
export type EventHandler<T extends EventName> = EventPayloads[T] extends void 
  ? () => void 
  : (payload: EventPayloads[T]) => void;

// ============================================================================
// EventBus Implementation
// ============================================================================

type Listener = {
  handler: Function;
  once: boolean;
};

class TypedEventBus {
  private listeners: Map<string, Set<Listener>> = new Map();
  private debugMode: boolean = false;
  
  /**
   * Enable debug logging for all events
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
  
  /**
   * Subscribe to an event
   * @returns Unsubscribe function
   */
  on<T extends EventName>(event: T, handler: EventHandler<T>): () => void {
    return this.addListener(event, handler, false);
  }
  
  /**
   * Subscribe to an event for one-time execution
   * @returns Unsubscribe function
   */
  once<T extends EventName>(event: T, handler: EventHandler<T>): () => void {
    return this.addListener(event, handler, true);
  }
  
  /**
   * Emit an event with optional payload
   */
  emit<T extends EventName>(
    event: T,
    ...args: EventPayloads[T] extends void ? [] : [EventPayloads[T]]
  ): void {
    const payload = args[0];
    
    if (this.debugMode) {
      console.log(`[EventBus] ${event}`, payload);
    }
    
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    
    // Copy the set to avoid mutation during iteration
    const listenersArray = Array.from(listeners);
    
    for (const listener of listenersArray) {
      try {
        if (payload !== undefined) {
          listener.handler(payload);
        } else {
          listener.handler();
        }
        
        if (listener.once) {
          listeners.delete(listener);
        }
      } catch (error) {
        console.error(`[EventBus] Error in handler for ${event}:`, error);
      }
    }
  }
  
  /**
   * Remove all listeners for an event (or all events if no event specified)
   */
  clear(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
  
  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
  
  private addListener(event: string, handler: Function, once: boolean): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const listener: Listener = { handler, once };
    this.listeners.get(event)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const eventBus = new TypedEventBus();

// ============================================================================
// Legacy Bridge (Temporary)
// 
// During migration, this bridges the new EventBus to the old window events.
// Remove once all code is migrated.
// ============================================================================

/**
 * Bridge legacy window events to the new EventBus
 * Call this once during app initialization
 */
export function bridgeLegacyEvents(): void {
  // Forward EventBus emissions to window for legacy code
  const forwardToWindow = <T extends EventName>(event: T) => {
    eventBus.on(event, ((payload: EventPayloads[T]) => {
      window.dispatchEvent(new CustomEvent(event, { detail: payload }));
    }) as EventHandler<T>);
  };
  
  // Bridge all settings events
  forwardToWindow(SettingsEvents.GAME_CHANGED);
  forwardToWindow(SettingsEvents.AUDIO_CHANGED);
  forwardToWindow(SettingsEvents.PHYSICS_CHANGED);
  forwardToWindow(SettingsEvents.GEOMETRY_CHANGED);
  forwardToWindow(SettingsEvents.MODERN_GEOMETRY_CHANGED);
  forwardToWindow(SettingsEvents.RENDER_CHANGED);
  forwardToWindow(SettingsEvents.UI_COLORS_CHANGED);
  forwardToWindow(SettingsEvents.COLORS_CHANGED);
  forwardToWindow(SettingsEvents.APPEARANCE_CHANGED);
  forwardToWindow(SettingsEvents.TEXTURE_CHANGED);
  
  // Bridge game events
  forwardToWindow(GameEvents.RESTART);
  forwardToWindow(GameEvents.PAUSE);
  forwardToWindow(GameEvents.RESUME);
  forwardToWindow(GameEvents.DEBUG_TOGGLE);
  
  // Bridge UI events
  forwardToWindow(UIEvents.STATE_CHANGED);
  forwardToWindow(UIEvents.REQUEST_CONFIRM_EXIT);
  
  // Bridge audio events
  forwardToWindow(AudioEvents.PREVIEW);
  
  console.log('[EventBus] Legacy bridge initialized');
}

/**
 * Listen for legacy window events and forward to EventBus
 * Call this once during app initialization
 */
export function listenForLegacyEvents(): void {
  const forwardFromWindow = <T extends EventName>(event: T) => {
    window.addEventListener(event, ((e: CustomEvent) => {
      // Avoid infinite loop - don't re-emit if already from EventBus
      if (e.detail?.__fromEventBus) return;
      (eventBus.emit as (event: EventName, payload?: unknown) => void)(event, e.detail);
    }) as EventListener);
  };
  
  // Listen for all known events
  forwardFromWindow(SettingsEvents.GAME_CHANGED);
  forwardFromWindow(SettingsEvents.AUDIO_CHANGED);
  forwardFromWindow(SettingsEvents.PHYSICS_CHANGED);
  forwardFromWindow(SettingsEvents.GEOMETRY_CHANGED);
  forwardFromWindow(SettingsEvents.MODERN_GEOMETRY_CHANGED);
  forwardFromWindow(SettingsEvents.RENDER_CHANGED);
  forwardFromWindow(SettingsEvents.UI_COLORS_CHANGED);
  forwardFromWindow(SettingsEvents.COLORS_CHANGED);
  forwardFromWindow(SettingsEvents.APPEARANCE_CHANGED);
  forwardFromWindow(SettingsEvents.TEXTURE_CHANGED);
  forwardFromWindow(GameEvents.RESTART);
  forwardFromWindow(GameEvents.PAUSE);
  forwardFromWindow(GameEvents.RESUME);
  forwardFromWindow(GameEvents.DEBUG_TOGGLE);
  forwardFromWindow(UIEvents.STATE_CHANGED);
  forwardFromWindow(UIEvents.REQUEST_CONFIRM_EXIT);
  forwardFromWindow(AudioEvents.PREVIEW);
}

// For debugging: expose eventBus globally
if (typeof window !== 'undefined') {
  (window as any).eventBus = eventBus;
}
