import React from 'react';
import { EditorState } from '../../state/EditorState';
import { EditorAction } from '../../state/reducer';

interface SceneOutlineProps {
    state: EditorState;
    dispatch: React.Dispatch<EditorAction>;
}

const SceneOutline: React.FC<SceneOutlineProps> = ({ state, dispatch }) => {
    const { config, selection } = state;

    const renderItem = (id: string, label: string, type: string) => {
        const isSelected = selection.includes(id);
        return (
            <div
                key={id}
                onClick={() => dispatch({ type: 'SELECT_OBJECT', payload: { id, multi: false } })}
                style={{
                    padding: '4px 8px',
                    cursor: 'pointer',
                    background: isSelected ? '#007acc' : 'transparent',
                    color: isSelected ? '#fff' : '#ccc',
                    fontSize: '13px',
                }}
            >
                <span style={{ opacity: 0.7, marginRight: '8px' }}>[{type}]</span>
                {label}
            </div>
        );
    };

    return (
        <div style={{ padding: '0', color: '#eee' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Scene</h3>
                <div>
                    <button
                        disabled={selection.length !== 1}
                        onClick={() => dispatch({ type: 'MOVE_OBJECT_ORDER', payload: { id: selection[0], direction: 'up' } })}
                        style={{ background: 'none', border: 'none', color: selection.length === 1 ? '#fff' : '#555', cursor: 'pointer' }}
                        title="Move Up (Draw Later)"
                    >
                        ▲
                    </button>
                    <button
                        disabled={selection.length !== 1}
                        onClick={() => dispatch({ type: 'MOVE_OBJECT_ORDER', payload: { id: selection[0], direction: 'down' } })}
                        style={{ background: 'none', border: 'none', color: selection.length === 1 ? '#fff' : '#555', cursor: 'pointer' }}
                        title="Move Down (Draw Earlier)"
                    >
                        ▼
                    </button>
                </div>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
                {config.rails.map(r => renderItem(r.id, `Rail ${r.id}`, 'Rail'))}
                {config.pockets.map(p => renderItem(p.id, p.label || `Pocket ${p.id}`, 'Pocket'))}
                {config.spawnPoints.map(s => renderItem(s.id, s.label, 'Spawn'))}
                {config.regions.map(r => renderItem(r.id, r.label || `Region ${r.id}`, 'Region'))}
            </div>
        </div>
    );
};

export default SceneOutline;
