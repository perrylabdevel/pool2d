import { PoolTableConfig } from '../model/PoolTableConfig';
import { INITIAL_TABLE_CONFIG } from '../state/EditorState';

export function exportConfig(config: PoolTableConfig): string {
    return JSON.stringify(config, null, 2);
}

export function importConfig(json: string): PoolTableConfig {
    try {
        const parsed = JSON.parse(json);
        // Basic validation
        if (!parsed.width || !parsed.height || !Array.isArray(parsed.rails)) {
            throw new Error('Invalid table configuration');
        }
        // Merge with default to ensure all fields exist
        return { ...INITIAL_TABLE_CONFIG, ...parsed };
    } catch (e) {
        console.error('Failed to import config:', e);
        throw e;
    }
}

export function downloadConfig(config: PoolTableConfig) {
    const json = exportConfig(config);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
