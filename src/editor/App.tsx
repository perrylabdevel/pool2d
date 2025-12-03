import React, { useReducer } from 'react';
import CanvasView from './components/CanvasView';
import TopBar from './components/TopBar';
import ObjectInspector from './components/Sidebar/ObjectInspector';
import SceneOutline from './components/Sidebar/SceneOutline';
import TableSettings from './components/Sidebar/TableSettings';
import { editorReducer } from './state/reducer';
import { INITIAL_EDITOR_STATE } from './state/EditorState';

const App: React.FC = () => {
    const [state, dispatch] = useReducer(editorReducer, INITIAL_EDITOR_STATE);

    // Keyboard Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                dispatch({ type: 'DELETE_SELECTION' });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dispatch]);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
            <TopBar state={state} dispatch={dispatch} />

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 1, background: '#111', position: 'relative', overflow: 'hidden' }}>
                    <CanvasView state={state} dispatch={dispatch} />
                </div>

                <div style={{ width: '300px', background: '#252526', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, overflowY: 'auto', borderBottom: '1px solid #333' }}>
                        <TableSettings state={state} dispatch={dispatch} />
                        <SceneOutline state={state} dispatch={dispatch} />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <ObjectInspector state={state} dispatch={dispatch} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
