import React from 'react';
import { EditorState } from '../../state/EditorState';
import { EditorAction } from '../../state/reducer';

interface TableSettingsProps {
    state: EditorState;
    dispatch: React.Dispatch<EditorAction>;
}

const TableSettings: React.FC<TableSettingsProps> = ({ state, dispatch }) => {
    const { config } = state;
    const renderOrder = config.renderOrder || ['frame', 'felt', 'pockets', 'rails', 'spawns'];

    const moveLayer = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...renderOrder];
        if (direction === 'up' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        } else if (direction === 'down' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        }
        dispatch({ type: 'UPDATE_RENDER_ORDER', payload: newOrder });
    };

    return (
        <div style={{ padding: '10px', color: '#eee' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #444', paddingBottom: '10px' }}>Table Settings</h3>

            <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#ccc' }}>Dimensions</h4>
                <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>Width</label>
                    <input
                        type="number"
                        value={config.width}
                        onChange={(e) => dispatch({ type: 'UPDATE_CONFIG', payload: { width: parseFloat(e.target.value) } })}
                        style={{ width: '100%', background: '#333', border: '1px solid #444', color: '#fff', padding: '4px' }}
                    />
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>Height</label>
                    <input
                        type="number"
                        value={config.height}
                        onChange={(e) => dispatch({ type: 'UPDATE_CONFIG', payload: { height: parseFloat(e.target.value) } })}
                        style={{ width: '100%', background: '#333', border: '1px solid #444', color: '#fff', padding: '4px' }}
                    />
                </div>
            </div>

            {config.frame && (
                <div style={{ marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#ccc' }}>Frame</h4>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#aaa' }}>Thickness</label>
                        <input
                            type="number"
                            value={config.frame.thickness}
                            onChange={(e) => {
                                const newThickness = parseFloat(e.target.value);
                                // Update frame points based on new thickness (simplified logic for rectangular frame)
                                // Ideally we'd have a more robust way to regenerate frame geometry
                                // For now, let's just update the thickness property and maybe the points if it's a simple rect
                                const w = config.width / 2 + newThickness;
                                const h = config.height / 2 + newThickness;
                                const newPoints = [
                                    { x: -w, y: -h },
                                    { x: w, y: -h },
                                    { x: w, y: h },
                                    { x: -w, y: h }
                                ];
                                dispatch({
                                    type: 'UPDATE_CONFIG',
                                    payload: {
                                        frame: { ...config.frame!, thickness: newThickness, points: newPoints }
                                    }
                                });
                            }}
                            style={{ width: '100%', background: '#333', border: '1px solid #444', color: '#fff', padding: '4px' }}
                        />
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#ccc' }}>Layer Order (Top = Front)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {renderOrder
                        .map((layer, index) => ({ layer, index }))
                        .reverse()
                        .map(({ layer, index }) => (
                            <div key={layer} style={{ display: 'flex', alignItems: 'center', background: '#333', padding: '5px', borderRadius: '4px' }}>
                                <span style={{ flex: 1, fontSize: '13px' }}>{layer.charAt(0).toUpperCase() + layer.slice(1)}</span>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <button
                                        onClick={() => moveLayer(index, 'up')}
                                        disabled={index === renderOrder.length - 1}
                                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '10px', padding: '0 4px' }}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        onClick={() => moveLayer(index, 'down')}
                                        disabled={index === 0}
                                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '10px', padding: '0 4px' }}
                                    >
                                        ▼
                                    </button>
                                </div>
                            </div>
                        ))}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                    Items at the top of the list are drawn on top.
                </div>
            </div>
        </div>
    );
};

export default TableSettings;
