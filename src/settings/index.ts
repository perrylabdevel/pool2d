/**
 * Settings Module
 * 
 * Centralized settings management for RailRush.
 */

export {
  STORAGE_KEYS,
  LEGACY_STORAGE_KEYS,
  migrateStorageKeys,
  cleanupLegacyKeys,
  readStorage,
  writeStorage,
  type StorageKey,
} from './StorageKeys';
