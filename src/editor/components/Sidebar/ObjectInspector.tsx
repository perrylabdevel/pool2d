import React from 'react';
import { EditorState } from '../../state/EditorState';
import { EditorAction } from '../../state/reducer';

interface ObjectInspectorProps {
    state: EditorState;
    dispatch: React.Dispatch<EditorAction>;
}

const ObjectInspector: React.FC<ObjectInspectorProps> = ({ state, dispatch }) => {
    const { selection, config } = state;

    if (selection.length === 0) {
        return <div style={{ padding: '10px', color: '#888' }}>No object selected</div>;
    }

    // For now, just handle single selection
    const selectedId = selection[0];

    // Find object (naive search for now)
    const rail = config.rails.find(r => r.id === selectedId);
    const pocket = config.pockets.find(p => p.id === selectedId);
    const spawn = config.spawnPoints.find(s => s.id === selectedId);
    const region = config.regions.find(r => r.id === selectedId);

    const selectedObject = rail || pocket || spawn || region;

    if (!selectedObject) {
        return <div style={{ padding: '10px', color: '#888' }}>Unknown object selected</div>;
    }

    return (
        <div style={{ padding: '10px', color: '#eee' }}>
            <h3 style={{ marginTop: 0 }}>Inspector</h3>
            <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>ID</label>
                <input
                    readOnly
                    value={selectedObject.id}
                    style={{ width: '100%', background: '#333', border: '1px solid #444', color: '#888', padding: '4px' }}
                />
            </div>

            <div style={{ marginBottom: '10px', display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>X</label>
                    <input
                        type="number"
                        value={(() => {
                            if (rail) {
                                // Calculate center
                                const minX = Math.min(...rail.points.map(p => p.x));
                                const maxX = Math.max(...rail.points.map(p => p.x));
                                return Math.round((minX + maxX) / 2);
                            }
                            if (pocket) return pocket.x;
                            if (spawn) return spawn.x;
                            // Region?
                            return 0;
                        })()}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (isNaN(val)) return;

                            if (rail) {
                                const currentCenterX = (Math.min(...rail.points.map(p => p.x)) + Math.max(...rail.points.map(p => p.x))) / 2;
                                const dx = val - currentCenterX;
                                const newPoints = rail.points.map(p => ({ ...p, x: p.x + dx }));
                                const newRails = config.rails.map(r => r.id === rail.id ? { ...r, points: newPoints } : r);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { rails: newRails } });
                            } else if (pocket) {
                                const newPockets = config.pockets.map(p => p.id === pocket.id ? { ...p, x: val } : p);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { pockets: newPockets } });
                            } else if (spawn) {
                                const newSpawns = config.spawnPoints.map(s => s.id === spawn.id ? { ...s, x: val } : s);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { spawnPoints: newSpawns } });
                            }
                        }}
                        style={{ width: '100%', background: '#333', border: '1px solid #444', color: '#fff', padding: '4px' }}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>Y</label>
                    <input
                        type="number"
                        value={(() => {
                            if (rail) {
                                // Calculate center
                                const minY = Math.min(...rail.points.map(p => p.y));
                                const maxY = Math.max(...rail.points.map(p => p.y));
                                return Math.round((minY + maxY) / 2);
                            }
                            if (pocket) return pocket.y;
                            if (spawn) return spawn.y;
                            return 0;
                        })()}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (isNaN(val)) return;

                            if (rail) {
                                const currentCenterY = (Math.min(...rail.points.map(p => p.y)) + Math.max(...rail.points.map(p => p.y))) / 2;
                                const dy = val - currentCenterY;
                                const newPoints = rail.points.map(p => ({ ...p, y: p.y + dy }));
                                const newRails = config.rails.map(r => r.id === rail.id ? { ...r, points: newPoints } : r);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { rails: newRails } });
                            } else if (pocket) {
                                const newPockets = config.pockets.map(p => p.id === pocket.id ? { ...p, y: val } : p);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { pockets: newPockets } });
                            } else if (spawn) {
                                const newSpawns = config.spawnPoints.map(s => s.id === spawn.id ? { ...s, y: val } : s);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { spawnPoints: newSpawns } });
                            }
                        }}
                        style={{ width: '100%', background: '#333', border: '1px solid #444', color: '#fff', padding: '4px' }}
                    />
                </div>
            </div>

            <div style={{ marginBottom: '10px', display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>Width</label>
                    <input
                        type="number"
                        disabled={!!spawn}
                        value={(() => {
                            if (rail) {
                                const minX = Math.min(...rail.points.map(p => p.x));
                                const maxX = Math.max(...rail.points.map(p => p.x));
                                return Math.round(maxX - minX);
                            }
                            if (pocket) return pocket.radius * 2;
                            // Region?
                            return 0;
                        })()}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (isNaN(val) || val <= 0) return;

                            if (rail) {
                                const minX = Math.min(...rail.points.map(p => p.x));
                                const maxX = Math.max(...rail.points.map(p => p.x));
                                const currentWidth = maxX - minX;
                                if (currentWidth === 0) return;

                                const scale = val / currentWidth;
                                const centerX = (minX + maxX) / 2;

                                const newPoints = rail.points.map(p => ({
                                    ...p,
                                    x: centerX + (p.x - centerX) * scale
                                }));
                                const newRails = config.rails.map(r => r.id === rail.id ? { ...r, points: newPoints } : r);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { rails: newRails } });
                            } else if (pocket) {
                                const newPockets = config.pockets.map(p => p.id === pocket.id ? { ...p, radius: val / 2 } : p);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { pockets: newPockets } });
                            }
                        }}
                        style={{ width: '100%', background: spawn ? '#222' : '#333', border: '1px solid #444', color: spawn ? '#555' : '#fff', padding: '4px' }}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>Height</label>
                    <input
                        type="number"
                        disabled={!!spawn}
                        value={(() => {
                            if (rail) {
                                const minY = Math.min(...rail.points.map(p => p.y));
                                const maxY = Math.max(...rail.points.map(p => p.y));
                                return Math.round(maxY - minY);
                            }
                            if (pocket) return pocket.radius * 2;
                            return 0;
                        })()}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (isNaN(val) || val <= 0) return;

                            if (rail) {
                                const minY = Math.min(...rail.points.map(p => p.y));
                                const maxY = Math.max(...rail.points.map(p => p.y));
                                const currentHeight = maxY - minY;
                                if (currentHeight === 0) return;

                                const scale = val / currentHeight;
                                const centerY = (minY + maxY) / 2;

                                const newPoints = rail.points.map(p => ({
                                    ...p,
                                    y: centerY + (p.y - centerY) * scale
                                }));
                                const newRails = config.rails.map(r => r.id === rail.id ? { ...r, points: newPoints } : r);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { rails: newRails } });
                            } else if (pocket) {
                                const newPockets = config.pockets.map(p => p.id === pocket.id ? { ...p, radius: val / 2 } : p);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { pockets: newPockets } });
                            }
                        }}
                        style={{ width: '100%', background: spawn ? '#222' : '#333', border: '1px solid #444', color: spawn ? '#555' : '#fff', padding: '4px' }}
                    />
                </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>Color</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                        type="color"
                        value={selectedObject.color || '#ffffff'}
                        onChange={(e) => {
                            const newColor = e.target.value;
                            // Helper to update specific list
                            const updateList = <T extends { id: string }>(list: T[]) =>
                                list.map(item => item.id === selectedId ? { ...item, color: newColor } : item);

                            if (rail) dispatch({ type: 'UPDATE_CONFIG', payload: { rails: updateList(config.rails) } });
                            if (pocket) dispatch({ type: 'UPDATE_CONFIG', payload: { pockets: updateList(config.pockets) } });
                        }}
                        style={{ background: 'none', border: 'none', width: '30px', height: '30px', padding: 0, cursor: 'pointer' }}
                    />
                    <input
                        type="text"
                        value={selectedObject.color || ''}
                        placeholder="Inherit"
                        onChange={(e) => {
                            const newColor = e.target.value;
                            // Helper to update specific list
                            const updateList = <T extends { id: string }>(list: T[]) =>
                                list.map(item => item.id === selectedId ? { ...item, color: newColor } : item);

                            if (rail) dispatch({ type: 'UPDATE_CONFIG', payload: { rails: updateList(config.rails) } });
                            if (pocket) dispatch({ type: 'UPDATE_CONFIG', payload: { pockets: updateList(config.pockets) } });
                        }}
                        style={{ flex: 1, background: '#444', border: '1px solid #555', color: '#fff', padding: '4px' }}
                    />
                </div>
            </div>

            {/* Type specific fields would go here */}
            {pocket && (
                <>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>Type</label>
                        <div style={{ padding: '4px' }}>Pocket ({pocket.type})</div>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>Radius</label>
                        <input
                            type="number"
                            value={pocket.radius}
                            onChange={(e) => {
                                const newRadius = parseFloat(e.target.value);
                                const newPockets = config.pockets.map(p => p.id === pocket.id ? { ...p, radius: newRadius } : p);
                                dispatch({ type: 'UPDATE_CONFIG', payload: { pockets: newPockets } });
                            }}
                            style={{ width: '100%', background: '#444', border: '1px solid #555', color: '#fff', padding: '4px' }}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default ObjectInspector;
