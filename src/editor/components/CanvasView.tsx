import React, { useRef, useEffect, useState } from 'react';
import { EditorState } from '../state/EditorState';
import { EditorAction } from '../state/reducer';
import { hitTest, hitTestHandle } from '../utils/hitTest';

interface CanvasViewProps {
    state: EditorState;
    dispatch: React.Dispatch<EditorAction>;
}

const CanvasView: React.FC<CanvasViewProps> = ({ state, dispatch }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [dragHandle, setDragHandle] = useState<{ objectId: string; handleIndex: number } | null>(null);

    // Accumulate drag delta for snapping
    const dragAccumulator = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply transformations
        ctx.save();
        ctx.translate(canvas.width / 2 + state.pan.x, canvas.height / 2 + state.pan.y);
        ctx.scale(state.zoom, state.zoom);

        // Draw Grid
        if (state.gridVisible) {
            drawGrid(ctx, state.gridSize, canvas.width, canvas.height, state.zoom, state.pan);
        }

        // Render Layers based on Order
        const renderOrder = state.config.renderOrder || ['frame', 'felt', 'pockets', 'rails', 'spawns'];

        renderOrder.forEach(layer => {
            switch (layer) {
                case 'frame':
                    if (state.config.frame) {
                        ctx.fillStyle = state.config.frame.color;
                        ctx.beginPath();
                        const points = state.config.frame.points;
                        if (points.length > 0) {
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                ctx.lineTo(points[i].x, points[i].y);
                            }
                            ctx.closePath();
                            ctx.fill();
                            ctx.strokeStyle = '#5d4037';
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                    }
                    break;
                case 'felt':
                    ctx.fillStyle = state.config.feltColor;
                    ctx.fillRect(
                        -state.config.width / 2,
                        -state.config.height / 2,
                        state.config.width,
                        state.config.height
                    );
                    break;
                case 'rails':
                    ctx.lineWidth = 2;
                    state.config.rails.forEach(rail => {
                        ctx.beginPath();
                        if (rail.points.length > 0) {
                            ctx.moveTo(rail.points[0].x, rail.points[0].y);
                            for (let i = 1; i < rail.points.length; i++) {
                                ctx.lineTo(rail.points[i].x, rail.points[i].y);
                            }
                            ctx.closePath();
                        }

                        const isSelected = state.selection.includes(rail.id);
                        const isHovered = hoveredId === rail.id;

                        ctx.fillStyle = isSelected ? 'rgba(255, 165, 0, 0.5)' : (isHovered ? 'rgba(255, 255, 255, 0.1)' : (rail.color || state.config.railColor));
                        ctx.fill();
                        ctx.strokeStyle = isSelected ? '#ffaa00' : (isHovered ? '#fff' : '#111');
                        ctx.stroke();

                        // Draw vertices for selected rails
                        if (isSelected) {
                            ctx.fillStyle = '#fff';
                            ctx.lineWidth = 1 / state.zoom;
                            rail.points.forEach(p => {
                                ctx.beginPath();
                                ctx.arc(p.x, p.y, 4 / state.zoom, 0, Math.PI * 2);
                                ctx.fill();
                                ctx.stroke();
                            });
                        }
                    });
                    break;
                case 'pockets':
                    state.config.pockets.forEach(pocket => {
                        const isSelected = state.selection.includes(pocket.id);
                        const isHovered = hoveredId === pocket.id;

                        ctx.beginPath();
                        ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
                        ctx.fillStyle = pocket.color || '#000';
                        ctx.fill();
                        ctx.strokeStyle = isSelected ? '#ffaa00' : (isHovered ? '#fff' : '#333');
                        ctx.lineWidth = (isSelected || isHovered) ? 2 / state.zoom : 1 / state.zoom;
                        ctx.stroke();
                    });
                    break;
                case 'spawns':
                    state.config.spawnPoints.forEach(spawn => {
                        const isSelected = state.selection.includes(spawn.id);
                        const isHovered = hoveredId === spawn.id;

                        ctx.beginPath();
                        ctx.arc(spawn.x, spawn.y, 5 / state.zoom, 0, Math.PI * 2); // Fixed visual size
                        ctx.fillStyle = isSelected ? '#ffaa00' : (isHovered ? '#eee' : (spawn.color || '#fff'));
                        ctx.fill();
                        ctx.strokeStyle = isHovered ? '#fff' : '#000';
                        ctx.lineWidth = 1 / state.zoom;
                        ctx.stroke();

                        // Label
                        ctx.fillStyle = '#fff';
                        ctx.font = `${12 / state.zoom}px Arial`;
                        ctx.fillText(spawn.label || 'Spawn', spawn.x + 8 / state.zoom, spawn.y + 4 / state.zoom);
                    });
                    break;
            }
        });

        ctx.restore();
    }, [state, canvasRef.current?.width, canvasRef.current?.height, hoveredId]); // Re-render on state change, resize, or hover

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = canvasRef.current.parentElement?.clientWidth || 800;
                canvasRef.current.height = canvasRef.current.parentElement?.clientHeight || 600;
            }
        }
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial size
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const snap = (val: number) => {
        if (!state.snapEnabled) return val;
        return Math.round(val / state.gridSize) * state.gridSize;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Reset accumulator on new drag
        dragAccumulator.current = { x: 0, y: 0 };

        // Calculate world coordinates
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Transform to world space
        const worldX = (mouseX - canvas.width / 2 - state.pan.x) / state.zoom;
        const worldY = (mouseY - canvas.height / 2 - state.pan.y) / state.zoom;

        if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle mouse or Alt+Left
            setIsDragging(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
            return;
        }

        if (state.activeTool === 'select' || state.activeTool === 'move') {
            // Check handles first (only for selected objects)
            const handleHit = hitTestHandle(state.config, state.selection, worldX, worldY, state.zoom);
            if (handleHit) {
                setDragHandle(handleHit);
                setIsDragging(true);
                setLastMousePos({ x: e.clientX, y: e.clientY });
                return;
            }

            const hitId = hitTest(state.config, worldX, worldY, state.zoom);

            if (hitId) {
                dispatch({ type: 'SELECT_OBJECT', payload: { id: hitId, multi: e.shiftKey } });
                // Always allow dragging if we clicked an object, regardless of tool
                setIsDragging(true);
                setLastMousePos({ x: e.clientX, y: e.clientY });
            } else {
                if (!e.shiftKey) {
                    dispatch({ type: 'DESELECT_ALL' });
                }
                // Allow panning if clicking on empty space
                setIsDragging(true);
                setLastMousePos({ x: e.clientX, y: e.clientY });
            }
        } else if (state.activeTool === 'add_rail') {
            dispatch({ type: 'ADD_RAIL', payload: { x: snap(worldX), y: snap(worldY) } });
        } else if (state.activeTool === 'add_pocket') {
            dispatch({ type: 'ADD_POCKET', payload: { x: snap(worldX), y: snap(worldY) } });
        } else if (state.activeTool === 'add_spawn') {
            dispatch({ type: 'ADD_SPAWN', payload: { x: snap(worldX), y: snap(worldY) } });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (isDragging) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;

            // Pan if middle mouse, alt key, or dragging empty space (no selection or handle)
            const isPanning = e.buttons === 4 || e.altKey || (!dragHandle && state.selection.length === 0);

            if (isPanning) {
                dispatch({ type: 'SET_PAN', payload: { x: state.pan.x + dx, y: state.pan.y + dy } });
            } else if (dragHandle) {
                // Move handle
                const worldX = (mouseX - canvas.width / 2 - state.pan.x) / state.zoom;
                const worldY = (mouseY - canvas.height / 2 - state.pan.y) / state.zoom;
                dispatch({ type: 'MOVE_HANDLE', payload: { ...dragHandle, x: snap(worldX), y: snap(worldY) } });
            } else if (state.selection.length > 0 && (state.activeTool === 'move' || state.activeTool === 'select')) {
                // Move objects
                const worldDx = dx / state.zoom;
                const worldDy = dy / state.zoom;

                if (state.snapEnabled) {
                    // Accumulate delta
                    dragAccumulator.current.x += worldDx;
                    dragAccumulator.current.y += worldDy;

                    // Check if accumulated delta exceeds grid size
                    let snapDx = 0;
                    let snapDy = 0;

                    if (Math.abs(dragAccumulator.current.x) >= state.gridSize) {
                        snapDx = Math.sign(dragAccumulator.current.x) * state.gridSize;
                        dragAccumulator.current.x -= snapDx;
                    }
                    if (Math.abs(dragAccumulator.current.y) >= state.gridSize) {
                        snapDy = Math.sign(dragAccumulator.current.y) * state.gridSize;
                        dragAccumulator.current.y -= snapDy;
                    }

                    if (snapDx !== 0 || snapDy !== 0) {
                        dispatch({ type: 'MOVE_SELECTION', payload: { dx: snapDx, dy: snapDy } });
                    }
                } else {
                    dispatch({ type: 'MOVE_SELECTION', payload: { dx: worldDx, dy: worldDy } });
                }
            }

            setLastMousePos({ x: e.clientX, y: e.clientY });
        } else {
            // Hover check
            const worldX = (mouseX - canvas.width / 2 - state.pan.x) / state.zoom;
            const worldY = (mouseY - canvas.height / 2 - state.pan.y) / state.zoom;

            const hitId = hitTest(state.config, worldX, worldY, state.zoom);
            setHoveredId(hitId);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragHandle(null);
        dragAccumulator.current = { x: 0, y: 0 };
    };

    const handleWheel = (e: React.WheelEvent) => {
        const zoomFactor = 0.1;
        const newZoom = state.zoom - Math.sign(e.deltaY) * zoomFactor;
        dispatch({ type: 'SET_ZOOM', payload: Math.max(0.1, Math.min(5, newZoom)) });
    };

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', cursor: isDragging ? 'grabbing' : (hoveredId ? 'pointer' : 'default') }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        />
    );
};

function drawGrid(
    ctx: CanvasRenderingContext2D,
    gridSize: number,
    width: number,
    height: number,
    zoom: number,
    pan: { x: number; y: number }
) {
    ctx.save();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1 / zoom; // Keep grid lines thin

    // Calculate visible range to optimize drawing
    // This is a simplified infinite grid
    const left = -width / 2 / zoom - pan.x / zoom;
    const right = width / 2 / zoom - pan.x / zoom;
    const top = -height / 2 / zoom - pan.y / zoom;
    const bottom = height / 2 / zoom - pan.y / zoom;

    // Draw vertical lines
    // ... (Simplified for now, just drawing a fixed large area)
    const range = 2000;
    ctx.beginPath();
    for (let x = -range; x <= range; x += gridSize) {
        ctx.moveTo(x, -range);
        ctx.lineTo(x, range);
    }
    for (let y = -range; y <= range; y += gridSize) {
        ctx.moveTo(-range, y);
        ctx.lineTo(range, y);
    }
    ctx.stroke();
    ctx.restore();
}

export default CanvasView;
