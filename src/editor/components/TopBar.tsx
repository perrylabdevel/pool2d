import React from 'react';
import { EditorState } from '../../state/EditorState';
import { EditorAction } from '../../state/reducer';
import { downloadConfig } from '../utils/json';
import { exportToSVG, parseSVG } from '../utils/svgUtils';

interface TopBarProps {
    state: EditorState;
    dispatch: React.Dispatch<EditorAction>;
}

const TopBar: React.FC<TopBarProps> = ({ state, dispatch }) => {
    const handleExport = () => {
        downloadConfig(state.config);
    };

    const handleExportSVG = () => {
        const svgContent = exportToSVG(state.config);
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", "pool_table.svg");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{ padding: '10px', background: '#333', borderBottom: '1px solid #444', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '18px', color: '#fff', marginRight: '20px' }}>Pool Table Editor</h1>

            <button onClick={() => dispatch({ type: 'SET_TOOL', payload: 'select' })} style={getButtonStyle(state.activeTool === 'select')}>Select</button>
            <button onClick={() => dispatch({ type: 'SET_TOOL', payload: 'move' })} style={getButtonStyle(state.activeTool === 'move')}>Move</button>
            <div style={{ width: '1px', height: '20px', background: '#555' }} />
            <button onClick={() => dispatch({ type: 'ADD_RAIL', payload: { x: 0, y: 0 } })} style={getButtonStyle(state.activeTool === 'add_rail')}>Add Rail</button>
            <button onClick={() => dispatch({ type: 'ADD_POCKET', payload: { x: 0, y: 0 } })} style={getButtonStyle(state.activeTool === 'add_pocket')}>Add Pocket</button>
            <button onClick={() => dispatch({ type: 'ADD_SPAWN', payload: { x: 0, y: 0 } })} style={getButtonStyle(state.activeTool === 'add_spawn')}>Add Spawn</button>

            <div style={{ flex: 1 }} />

            <button onClick={() => dispatch({ type: 'TOGGLE_GRID' })} style={getButtonStyle(state.gridVisible)}>Grid</button>
            <button onClick={() => dispatch({ type: 'TOGGLE_SNAP' })} style={getButtonStyle(state.snapEnabled)}>Snap</button>
            <div style={{ width: '1px', height: '20px', background: '#555' }} />
            <button onClick={() => dispatch({ type: 'DELETE_SELECTION' })} style={{ ...getButtonStyle(false), background: '#d9534f' }} disabled={state.selection.length === 0}>Delete</button>
            <button onClick={() => { if (confirm('Clear scene?')) dispatch({ type: 'CLEAR_SCENE' }) }} style={getButtonStyle(false)}>Clear</button>
            <button onClick={() => { if (confirm('Reset to default setup?')) dispatch({ type: 'RESET_TO_DEFAULT' }) }} style={getButtonStyle(false)}>Default</button>
            <div style={{ width: '1px', height: '20px', background: '#555' }} />
            <button onClick={handleExportSVG} style={getButtonStyle(false)}>Export SVG</button>
            <label style={{ ...getButtonStyle(false), display: 'inline-block', marginBottom: 0 }}>
                Import SVG
                <input
                    type="file"
                    accept=".svg"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            try {
                                const svgString = ev.target?.result as string;
                                const partialConfig = parseSVG(svgString);
                                if (Object.keys(partialConfig).length > 0) {
                                    dispatch({ type: 'UPDATE_CONFIG', payload: partialConfig });
                                } else {
                                    alert('No valid rails or pockets found in SVG');
                                }
                            } catch (err) {
                                console.error(err);
                                alert('Failed to parse SVG');
                            }
                        };
                        reader.readAsText(file);
                        e.target.value = ''; // Reset
                    }}
                />
            </label>
            <div style={{ width: '1px', height: '20px', background: '#555' }} />
            <button onClick={handleExport} style={getButtonStyle(false)}>Export JSON</button>
            <label style={{ ...getButtonStyle(false), display: 'inline-block', marginBottom: 0 }}>
                Import JSON
                <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            try {
                                const json = JSON.parse(ev.target?.result as string);
                                dispatch({ type: 'IMPORT_CONFIG', payload: json });
                            } catch (err) {
                                alert('Failed to parse JSON');
                            }
                        };
                        reader.readAsText(file);
                        e.target.value = ''; // Reset
                    }}
                />
            </label>
        </div>
    );
};

const getButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    background: active ? '#007acc' : '#444',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
});

export default TopBar;
