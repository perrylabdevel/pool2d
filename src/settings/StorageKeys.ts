/**
 * Storage Keys for RailRush
 * 
 * Centralized storage key definitions with migration from legacy keys.
 */

// New storage keys (RailRush prefix)
export const STORAGE_KEYS = {
  GAME_SETTINGS: 'RailRush_game_settings',
  UI_COLORS: 'RailRush_ui_colors',
  PHYSICS_SETTINGS: 'RailRush_physics_settings',
  GEOMETRY_SETTINGS: 'RailRush_geometry_settings',
  RENDER_SETTINGS: 'RailRush_render_settings',
  MODERN_GEOMETRY_SETTINGS: 'RailRush_modern_geometry_settings',
  AUDIO_SETTINGS: 'RailRush_audio_settings',
  GAME_STATS: 'RailRush_game_stats',
  DEBUG_SETTINGS: 'RailRush_debug_settings',
  TEXTURE_SETTINGS: 'RailRush_texture_settings',
  TABLE_APPEARANCE: 'RailRush_table_appearance',
  CREATOR_LAYOUTS: 'RailRush_creator_layouts',
  // Migration flag
  MIGRATION_VERSION: 'RailRush_migration_version',
} as const;

// Legacy storage keys (pool2d prefix) - for migration only
export const LEGACY_STORAGE_KEYS = {
  GAME_SETTINGS: 'pool2d_game_settings',
  UI_COLORS: 'pool2d_ui_colors',
  PHYSICS_SETTINGS: 'pool2d_physics_settings',
  GEOMETRY_SETTINGS: 'pool2d_geometry_settings',
  RENDER_SETTINGS: 'pool2d_render_settings',
  MODERN_GEOMETRY_SETTINGS: 'pool2d_modern_geometry_settings',
  AUDIO_SETTINGS: 'pool2d_audio_settings',
  GAME_STATS: 'pool2d_game_stats',
  DEBUG_SETTINGS: 'pool2d_debug_settings',
  TEXTURE_SETTINGS: 'pool2d_texture_settings',
  TABLE_APPEARANCE: 'pool2d_table_appearance',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

// Current migration version
const CURRENT_MIGRATION_VERSION = 1;

/**
 * Migrate storage from legacy pool2d_* keys to RailRush_* keys
 * This is idempotent - safe to call multiple times
 */
export function migrateStorageKeys(): void {
  const storedVersion = localStorage.getItem(STORAGE_KEYS.MIGRATION_VERSION);
  const version = storedVersion ? parseInt(storedVersion, 10) : 0;
  
  if (version >= CURRENT_MIGRATION_VERSION) {
    return; // Already migrated
  }
  
  console.log('[Storage] Migrating from pool2d_* to RailRush_* keys...');
  
  // Map of legacy key -> new key
  const keyMapping: Record<string, string> = {
    [LEGACY_STORAGE_KEYS.GAME_SETTINGS]: STORAGE_KEYS.GAME_SETTINGS,
    [LEGACY_STORAGE_KEYS.UI_COLORS]: STORAGE_KEYS.UI_COLORS,
    [LEGACY_STORAGE_KEYS.PHYSICS_SETTINGS]: STORAGE_KEYS.PHYSICS_SETTINGS,
    [LEGACY_STORAGE_KEYS.GEOMETRY_SETTINGS]: STORAGE_KEYS.GEOMETRY_SETTINGS,
    [LEGACY_STORAGE_KEYS.RENDER_SETTINGS]: STORAGE_KEYS.RENDER_SETTINGS,
    [LEGACY_STORAGE_KEYS.MODERN_GEOMETRY_SETTINGS]: STORAGE_KEYS.MODERN_GEOMETRY_SETTINGS,
    [LEGACY_STORAGE_KEYS.AUDIO_SETTINGS]: STORAGE_KEYS.AUDIO_SETTINGS,
    [LEGACY_STORAGE_KEYS.GAME_STATS]: STORAGE_KEYS.GAME_STATS,
    [LEGACY_STORAGE_KEYS.DEBUG_SETTINGS]: STORAGE_KEYS.DEBUG_SETTINGS,
    [LEGACY_STORAGE_KEYS.TEXTURE_SETTINGS]: STORAGE_KEYS.TEXTURE_SETTINGS,
    [LEGACY_STORAGE_KEYS.TABLE_APPEARANCE]: STORAGE_KEYS.TABLE_APPEARANCE,
  };
  
  let migratedCount = 0;
  
  for (const [legacyKey, newKey] of Object.entries(keyMapping)) {
    const legacyValue = localStorage.getItem(legacyKey);
    const newValue = localStorage.getItem(newKey);
    
    // Only migrate if legacy exists and new doesn't
    if (legacyValue && !newValue) {
      localStorage.setItem(newKey, legacyValue);
      migratedCount++;
      console.log(`  Migrated: ${legacyKey} → ${newKey}`);
    }
  }
  
  // Mark migration as complete
  localStorage.setItem(STORAGE_KEYS.MIGRATION_VERSION, String(CURRENT_MIGRATION_VERSION));
  
  if (migratedCount > 0) {
    console.log(`[Storage] Migration complete. Migrated ${migratedCount} keys.`);
  } else {
    console.log('[Storage] No legacy keys found to migrate.');
  }
}

/**
 * Remove all legacy storage keys (call after confirming migration worked)
 */
export function cleanupLegacyKeys(): void {
  for (const legacyKey of Object.values(LEGACY_STORAGE_KEYS)) {
    localStorage.removeItem(legacyKey);
  }
  console.log('[Storage] Legacy keys cleaned up.');
}

/**
 * Helper to safely read JSON from localStorage
 */
export function readStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return { ...defaultValue, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn(`Failed to read ${key}:`, e);
  }
  return { ...defaultValue };
}

/**
 * Helper to safely write JSON to localStorage
 */
export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to write ${key}:`, e);
  }
}
