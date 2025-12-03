import { PoolTableConfig } from '../model/PoolTableConfig';

export interface EditorState {
    config: PoolTableConfig;
    selection: string[]; // IDs of selected objects
    activeTool: 'select' | 'move' | 'rotate' | 'resize' | 'add_rail' | 'add_pocket' | 'add_spawn';
    gridVisible: boolean;
    gridSize: number;
    snapEnabled: boolean;
    zoom: number;
    pan: { x: number; y: number };
}

export const INITIAL_TABLE_CONFIG: PoolTableConfig = {
    id: 'default-table',
    name: 'New Table',
    width: 900, // Standard 9ft table width in cm (approx) or units
    height: 500,
    feltColor: '#2e8b57', // SeaGreen
    railColor: '#8b4513', // SaddleBrown
    cushionColor: '#20b2aa', // LightSeaGreen
    defaultBallRadius: 2.85, // Standard pool ball radius in cm
    rails: [],
    pockets: [],
    spawnPoints: [],
    regions: [],
    frame: {
        id: 'frame-main',
        points: [
            { x: -500, y: -300 },
            { x: 500, y: -300 },
            { x: 500, y: 300 },
            { x: -500, y: 300 }
        ],
        thickness: 50,
        color: '#8b4513'
    }
};

export const INITIAL_EDITOR_STATE: EditorState = {
    config: INITIAL_TABLE_CONFIG,
    selection: [],
    activeTool: 'select',
    gridVisible: true,
    gridSize: 10,
    snapEnabled: true,
    zoom: 1,
    pan: { x: 0, y: 0 },
};
