import { EditorState } from './EditorState';
import { PoolTableConfig } from '../model/PoolTableConfig';

export type EditorAction =
        | { type: 'SET_CONFIG'; payload: PoolTableConfig }
        | { type: 'UPDATE_CONFIG'; payload: Partial<PoolTableConfig> }
        | { type: 'SELECT_OBJECT'; payload: { id: string; multi: boolean } }
        | { type: 'DESELECT_ALL' }
        | { type: 'SET_TOOL'; payload: EditorState['activeTool'] }
        | { type: 'SET_ZOOM'; payload: number }
        | { type: 'SET_PAN'; payload: { x: number; y: number } }
        | { type: 'TOGGLE_GRID' }
        | { type: 'TOGGLE_SNAP' }
        | { type: 'ADD_RAIL'; payload: { x: number; y: number } }
        | { type: 'ADD_POCKET'; payload: { x: number; y: number } }
        | { type: 'ADD_SPAWN'; payload: { x: number; y: number } }
        | { type: 'MOVE_SELECTION'; payload: { dx: number; dy: number } }
        | { type: 'MOVE_HANDLE'; payload: { objectId: string; handleIndex: number; x: number; y: number } }
        | { type: 'DELETE_SELECTION' }
        | { type: 'CLEAR_SCENE' }
        | { type: 'RESET_TO_DEFAULT' }
        | { type: 'IMPORT_CONFIG'; payload: PoolTableConfig }
        | { type: 'MOVE_OBJECT_ORDER'; payload: { id: string; direction: 'up' | 'down' } }
        | { type: 'UPDATE_RENDER_ORDER'; payload: string[] };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
        switch (action.type) {
                case 'SET_CONFIG':
                        return { ...state, config: action.payload };
                case 'UPDATE_CONFIG':
                        return { ...state, config: { ...state.config, ...action.payload } };
                case 'SELECT_OBJECT': {
                        const { id, multi } = action.payload;
                        if (multi) {
                                const isSelected = state.selection.includes(id);
                                return {
                                        ...state,
                                        selection: isSelected
                                                ? state.selection.filter((s) => s !== id)
                                                : [...state.selection, id],
                                };
                        }
                        return { ...state, selection: [id] };
                }
                case 'DESELECT_ALL':
                        return { ...state, selection: [] };
                case 'SET_TOOL':
                        return { ...state, activeTool: action.payload };
                case 'SET_ZOOM':
                        return { ...state, zoom: action.payload };
                case 'SET_PAN':
                        return { ...state, pan: action.payload };
                case 'TOGGLE_GRID':
                        return { ...state, gridVisible: !state.gridVisible };
                case 'TOGGLE_SNAP':
                        return { ...state, snapEnabled: !state.snapEnabled };
                case 'ADD_RAIL': {
                        const { x, y } = action.payload;
                        const newRail = {
                                id: `rail-${Date.now()}`,
                                type: 'cushion' as const,
                                points: [
                                        { x: x - 10, y: y - 5 },
                                        { x: x + 10, y: y - 5 },
                                        { x: x + 10, y: y + 5 },
                                        { x: x - 10, y: y + 5 },
                                ],
                        };
                        return {
                                ...state,
                                config: { ...state.config, rails: [...state.config.rails, newRail] },
                                selection: [newRail.id],
                                activeTool: 'select',
                        };
                }
                case 'ADD_POCKET': {
                        const { x, y } = action.payload;
                        const newPocket = {
                                id: `pocket-${Date.now()}`,
                                x,
                                y,
                                radius: 4,
                                type: 'corner' as const,
                        };
                        return {
                                ...state,
                                config: { ...state.config, pockets: [...state.config.pockets, newPocket] },
                                selection: [newPocket.id],
                                activeTool: 'select',
                        };
                }
                case 'ADD_SPAWN': {
                        const { x, y } = action.payload;
                        const newSpawn = {
                                id: `spawn-${Date.now()}`,
                                x,
                                y,
                                label: 'New Spawn',
                        };
                        return {
                                ...state,
                                config: { ...state.config, spawnPoints: [...state.config.spawnPoints, newSpawn] },
                                selection: [newSpawn.id],
                                activeTool: 'select',
                        };
                }
                case 'MOVE_SELECTION': {
                        const { dx, dy } = action.payload;
                        const { selection, config } = state;

                        const newRails = config.rails.map(r =>
                                selection.includes(r.id)
                                        ? { ...r, points: r.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
                                        : r
                        );

                        const newPockets = config.pockets.map(p =>
                                selection.includes(p.id) ? { ...p, x: p.x + dx, y: p.y + dy } : p
                        );

                        const newSpawns = config.spawnPoints.map(s =>
                                selection.includes(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s
                        );

                        const newRegions = config.regions.map(r =>
                                selection.includes(r.id)
                                        ? { ...r, points: r.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
                                        : r
                        );

                        return {
                                ...state,
                                config: {
                                        ...config,
                                        rails: newRails,
                                        pockets: newPockets,
                                        spawnPoints: newSpawns,
                                        regions: newRegions,
                                },
                        };
                }
                case 'MOVE_HANDLE': {
                        const { objectId, handleIndex, x, y } = action.payload;
                        const { config } = state;

                        const newRails = config.rails.map(r => {
                                if (r.id === objectId) {
                                        const newPoints = [...r.points];
                                        if (newPoints[handleIndex]) {
                                                newPoints[handleIndex] = { x, y };
                                        }
                                        return { ...r, points: newPoints };
                                }
                                return r;
                        });

                        return {
                                ...state,
                                config: {
                                        ...config,
                                        rails: newRails,
                                }
                        };
                }
                case 'DELETE_SELECTION': {
                        const { selection, config } = state;
                        return {
                                ...state,
                                config: {
                                        ...config,
                                        rails: config.rails.filter(r => !selection.includes(r.id)),
                                        pockets: config.pockets.filter(p => !selection.includes(p.id)),
                                        spawnPoints: config.spawnPoints.filter(s => !selection.includes(s.id)),
                                        regions: config.regions.filter(r => !selection.includes(r.id)),
                                },
                                selection: [],
                        };
                }
                case 'CLEAR_SCENE':
                        return {
                                ...state,
                                config: {
                                        ...state.config,
                                        rails: [],
                                        pockets: [],
                                        spawnPoints: [],
                                        regions: [],
                                },
                                selection: [],
                        };
                case 'RESET_TO_DEFAULT':
                        // Import here to avoid circular dependency issues if possible, or just use the initial constant
                        // Assuming INITIAL_TABLE_CONFIG is available or we reconstruct a default
                        return {
                                ...state,
                                config: {
                                        ...state.config, // Keep some settings? Or reset all? Let's reset objects but keep dimensions for now or just full reset.
                                        width: 900,
                                        height: 500,
                                        // Let's do a full reset of objects to a standard pool table layout
                                        rails: [
                                                // Top-Left Rail
                                                {
                                                        id: 'rail-top-left',
                                                        type: 'cushion',
                                                        points: [
                                                                { x: -450, y: -250 }, // Outer Top-Left
                                                                { x: -25, y: -250 },  // Outer Top-Right (Side Pocket Gap)
                                                                { x: -35, y: -220 },  // Inner Top-Right (Side Pocket Jaw)
                                                                { x: -410, y: -220 }  // Inner Top-Left (Corner Pocket Jaw)
                                                        ]
                                                },
                                                // Top-Right Rail
                                                {
                                                        id: 'rail-top-right',
                                                        type: 'cushion',
                                                        points: [
                                                                { x: 25, y: -250 },   // Outer Top-Left (Side Pocket Gap)
                                                                { x: 450, y: -250 },  // Outer Top-Right
                                                                { x: 410, y: -220 },  // Inner Top-Right (Corner Pocket Jaw)
                                                                { x: 35, y: -220 }    // Inner Top-Left (Side Pocket Jaw)
                                                        ]
                                                },
                                                // Bottom-Left Rail
                                                {
                                                        id: 'rail-bottom-left',
                                                        type: 'cushion',
                                                        points: [
                                                                { x: -450, y: 250 },  // Outer Bottom-Left
                                                                { x: -25, y: 250 },   // Outer Bottom-Right (Side Pocket Gap)
                                                                { x: -35, y: 220 },   // Inner Bottom-Right (Side Pocket Jaw)
                                                                { x: -410, y: 220 }   // Inner Bottom-Left (Corner Pocket Jaw)
                                                        ]
                                                },
                                                // Bottom-Right Rail
                                                {
                                                        id: 'rail-bottom-right',
                                                        type: 'cushion',
                                                        points: [
                                                                { x: 25, y: 250 },    // Outer Bottom-Left (Side Pocket Gap)
                                                                { x: 450, y: 250 },   // Outer Bottom-Right
                                                                { x: 410, y: 220 },   // Inner Bottom-Right (Corner Pocket Jaw)
                                                                { x: 35, y: 220 }     // Inner Bottom-Left (Side Pocket Jaw)
                                                        ]
                                                },
                                                // Left Rail
                                                {
                                                        id: 'rail-left',
                                                        type: 'cushion',
                                                        points: [
                                                                { x: -450, y: -210 }, // Outer Top-Left
                                                                { x: -420, y: -175 }, // Inner Top-Left (Corner Pocket Jaw)
                                                                { x: -420, y: 175 },  // Inner Bottom-Left (Corner Pocket Jaw)
                                                                { x: -450, y: 210 }   // Outer Bottom-Left
                                                        ]
                                                },
                                                // Right Rail
                                                {
                                                        id: 'rail-right',
                                                        type: 'cushion',
                                                        points: [
                                                                { x: 450, y: -210 },  // Outer Top-Right
                                                                { x: 420, y: -175 },  // Inner Top-Right (Corner Pocket Jaw)
                                                                { x: 420, y: 175 },   // Inner Bottom-Right (Corner Pocket Jaw)
                                                                { x: 450, y: 210 }    // Outer Bottom-Right
                                                        ]
                                                },
                                        ],
                                        pockets: [
                                                { id: 'pocket-tl', x: -430, y: -230, radius: 22, type: 'corner' },
                                                { id: 'pocket-tr', x: 430, y: -230, radius: 22, type: 'corner' },
                                                { id: 'pocket-bl', x: -430, y: 230, radius: 22, type: 'corner' },
                                                { id: 'pocket-br', x: 430, y: 230, radius: 22, type: 'corner' },
                                                { id: 'pocket-tm', x: 0, y: -240, radius: 20, type: 'side' },
                                                { id: 'pocket-bm', x: 0, y: 240, radius: 20, type: 'side' },
                                        ],
                                        spawnPoints: [
                                                { id: 'spawn-cue', x: -200, y: 0, label: 'Cue Ball' },
                                                { id: 'spawn-rack', x: 200, y: 0, label: 'Rack' },
                                        ],
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
                                        },
                                        renderOrder: ['frame', 'felt', 'pockets', 'rails', 'spawns']
                                },
                                selection: [],
                        };
                case 'IMPORT_CONFIG':
                        return {
                                ...state,
                                config: action.payload,
                                selection: [],
                        };
                case 'MOVE_OBJECT_ORDER': {
                        const { id, direction } = action.payload;
                        const { config } = state;

                        // Helper to move item in array
                        const moveItem = <T extends { id: string }>(arr: T[], id: string, dir: 'up' | 'down'): T[] => {
                                const index = arr.findIndex(item => item.id === id);
                                if (index === -1) return arr;

                                const newArr = [...arr];
                                if (dir === 'up' && index < newArr.length - 1) {
                                        [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]];
                                } else if (dir === 'down' && index > 0) {
                                        [newArr[index], newArr[index - 1]] = [newArr[index - 1], newArr[index]];
                                }
                                return newArr;
                        };

                        return {
                                ...state,
                                config: {
                                        ...config,
                                        rails: moveItem(config.rails, id, direction),
                                        pockets: moveItem(config.pockets, id, direction),
                                        spawnPoints: moveItem(config.spawnPoints, id, direction),
                                        regions: moveItem(config.regions, id, direction),
                                }
                        };
                }
                case 'UPDATE_RENDER_ORDER':
                        return {
                                ...state,
                                config: { ...state.config, renderOrder: action.payload }
                        };
                default:
                        return state;
        }
}
