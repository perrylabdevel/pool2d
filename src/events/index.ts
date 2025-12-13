/**
 * Events Module
 * 
 * Centralized event system for RailRush.
 */

export {
  eventBus,
  GameEvents,
  SettingsEvents,
  UIEvents,
  AudioEvents,
  bridgeLegacyEvents,
  listenForLegacyEvents,
  type EventPayloads,
  type EventName,
  type EventHandler,
} from './EventBus';
