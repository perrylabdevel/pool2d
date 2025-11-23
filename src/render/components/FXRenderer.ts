import { CONFIG } from '../../config';
import { PocketAnimationEvent } from '../ControlTypes';
import { getTableGeometry } from '../../geometry/Geometry';
import { lightenHexColor, darkenHexColor } from '../RenderUtils';

type ShakeState = {
    start: number;
    duration: number;
    strength: number;
    seed: number;
} | null;

type PocketAnimation = {
    event: PocketAnimationEvent;
    startTime: number;
    duration: number;
};

type IconCacheEntry = {
    img: HTMLImageElement;
    ready: boolean;
    failed: boolean;
};

export class FXRenderer {
    private queuedPocketEvents: PocketAnimationEvent[] = [];
    private pocketAnimations: PocketAnimation[] = [];
    private pocketIconCache: Map<string, IconCacheEntry> = new Map();
    private shakeState: ShakeState = null;

    constructor(
        private uiCtx: CanvasRenderingContext2D,
        private canvas: HTMLCanvasElement,
        private getScale: () => number,
        private worldToScreen: (x: number, y: number) => { x: number; y: number },
        private referenceOverlay?: HTMLElement
    ) { }

    queuePocketAnimation(event: PocketAnimationEvent) {
        this.queuedPocketEvents.push(event);
    }

    processPocketAnimationQueue() {
        if (!this.queuedPocketEvents.length) return;
        const dropDuration = CONFIG.POCKET_ANIMATION_DROP_DURATION_MS ?? 300;
        const rollDuration = CONFIG.POCKET_ANIMATION_ROLL_DURATION_MS ?? 500;
        const duration = dropDuration + rollDuration;
        const now = performance.now();
        while (this.queuedPocketEvents.length) {
            const event = this.queuedPocketEvents.shift()!;
            this.pocketAnimations.push({ event, startTime: now, duration });
        }
    }

    drawPocketAnimations() {
        if (!this.pocketAnimations.length) return;
        const now = performance.now();
        const ctx = this.uiCtx;
        ctx.save();
        this.pocketAnimations = this.pocketAnimations.filter((anim) => {
            const elapsed = now - anim.startTime;
            const progress = Math.min(1, elapsed / Math.max(anim.duration, 1));
            this.drawPocketAnimationSprite(anim.event, progress, ctx);
            return progress < 1;
        });
        ctx.restore();
    }

    private drawPocketAnimationSprite(event: PocketAnimationEvent, progress: number, ctx: CanvasRenderingContext2D) {
        const startScreen = this.worldToScreen(event.position.x, event.position.y);
        const endScreen = this.worldToScreen(event.pocket.x, event.pocket.y);
        const centerScreen = this.worldToScreen(0, 0);
        const scale = this.getScale();

        const baseRadius = Math.max(3, event.radius * scale);

        // Get separate durations for drop and roll phases
        const dropDuration = CONFIG.POCKET_ANIMATION_DROP_DURATION_MS ?? 300;
        const rollDuration = CONFIG.POCKET_ANIMATION_ROLL_DURATION_MS ?? 500;
        const totalDuration = dropDuration + rollDuration;
        const dropPhaseEnd = dropDuration / totalDuration;

        const rollDistance = (CONFIG.POCKET_ANIMATION_UNDERFELT_PX ?? 10) * scale;

        // Pocket opening radius for clipping
        const pocketOpeningRadius = (CONFIG.POCKET_VISUAL_RADIUS_SIDE ?? 2.5) * scale;

        let x: number, y: number, radius: number;

        // Ball stays full size always - no shrinking
        radius = baseRadius;

        if (progress < dropPhaseEnd) {
            // Phase 1: Ball drops into pocket (visible while dropping)
            const dropT = progress / dropPhaseEnd;
            const eased = dropT * dropT * (3 - 2 * dropT);

            x = startScreen.x + (endScreen.x - startScreen.x) * eased;
            y = startScreen.y + (endScreen.y - startScreen.y) * eased;
        } else {
            // Phase 2: Ball rolls underneath felt from pocket center inward toward table center
            const rollT = (progress - dropPhaseEnd) / (1 - dropPhaseEnd);
            const eased = rollT * rollT * (3 - 2 * rollT);

            // Direction from pocket toward table center (inward)
            const dirX = centerScreen.x - endScreen.x;
            const dirY = centerScreen.y - endScreen.y;
            const len = Math.hypot(dirX, dirY) || 1;

            // Start at pocket center, roll inward toward table center
            x = endScreen.x + (dirX / len) * rollDistance * eased;
            y = endScreen.y + (dirY / len) * rollDistance * eased;
        }

        // Clip to circular pocket opening - ball only visible through the "hole"
        ctx.save();
        ctx.beginPath();
        ctx.arc(endScreen.x, endScreen.y, pocketOpeningRadius, 0, Math.PI * 2);
        ctx.clip();

        const colors = this.getBallColor(event.ballId);
        const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.15, x, y, radius);
        gradient.addColorStop(0, colors.light);
        gradient.addColorStop(1, colors.dark);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        const iconImage = this.getPocketIconImage(event.icon);
        if (iconImage) {
            const size = radius * 2;
            ctx.drawImage(iconImage, x - radius, y - radius, size, size);
        }

        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.stroke();

        ctx.restore();
    }

    private getBallColor(ballId: number) {
        const hex = CONFIG.BALL_COLORS[ballId - 1] || '#ffffff';
        const base = hex.startsWith('#') ? hex : `#${hex}`;
        const light = lightenHexColor(base, 0.2);
        const dark = darkenHexColor(base, 0.35);
        return { light, dark };
    }

    private getPocketIconImage(iconSrc?: string) {
        if (!iconSrc) return null;
        let entry = this.pocketIconCache.get(iconSrc);
        if (!entry) {
            const img = new Image();
            entry = { img, ready: img.complete, failed: false };
            img.onload = () => {
                entry!.ready = true;
            };
            img.onerror = () => {
                entry!.failed = true;
            };
            img.src = iconSrc;
            this.pocketIconCache.set(iconSrc, entry);
        }
        if (entry.failed || !entry.ready) return null;
        return entry.img;
    }

    triggerShotShake(intensity: number) {
        const clamped = Math.max(0, Math.min(1, intensity));
        if (clamped <= 0) return;
        const duration = CONFIG.HEAVY_SHOT_SHAKE_DURATION_MS ?? 240;
        const strength = (CONFIG.HEAVY_SHOT_SHAKE_MAX_OFFSET_PX ?? 5) * clamped;
        this.shakeState = {
            start: performance.now(),
            duration,
            strength,
            seed: Math.random() * Math.PI * 2,
        };
    }

    computeShakeOffset() {
        if (!this.shakeState) return { x: 0, y: 0 };
        const now = performance.now();
        const elapsed = now - this.shakeState.start;
        if (elapsed >= this.shakeState.duration) {
            this.shakeState = null;
            return { x: 0, y: 0 };
        }
        const progress = elapsed / Math.max(1, this.shakeState.duration);
        const decay = 1 - progress;
        const angle = now * 0.04 + this.shakeState.seed;
        const x = Math.cos(angle * 50) * this.shakeState.strength * decay;
        const y = Math.sin(angle * 60) * this.shakeState.strength * decay;
        return { x, y };
    }

    applyShakeTransform(x: number, y: number) {
        const transform = Math.abs(x) < 0.01 && Math.abs(y) < 0.01
            ? ''
            : `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
        this.canvas.style.transform = transform;
        if (this.uiCtx.canvas) {
            this.uiCtx.canvas.style.transform = transform;
        }
        if (this.referenceOverlay) {
            this.referenceOverlay.style.transform = transform;
        }
    }

    drawMeasurementOverlay() {
        const ctx = this.uiCtx;
        const geom = getTableGeometry();
        const halfW = geom.playWidthIn / 2;
        const halfH = geom.playHeightIn / 2;
        const tickSpacing = 10;
        const labelSpacing = 20;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Table outline
        const topLeft = this.worldToScreen(-halfW, halfH);
        const topRight = this.worldToScreen(halfW, halfH);
        const bottomLeft = this.worldToScreen(-halfW, -halfH);
        const bottomRight = this.worldToScreen(halfW, -halfH);

        ctx.beginPath();
        ctx.moveTo(topLeft.x, topLeft.y);
        ctx.lineTo(topRight.x, topRight.y);
        ctx.lineTo(bottomRight.x, bottomRight.y);
        ctx.lineTo(bottomLeft.x, bottomLeft.y);
        ctx.closePath();
        ctx.stroke();

        // Vertical ticks and labels
        for (let x = -halfW; x <= halfW + 0.01; x += tickSpacing) {
            const top = this.worldToScreen(x, halfH);
            const bottom = this.worldToScreen(x, -halfH);

            ctx.beginPath();
            ctx.moveTo(top.x, top.y);
            ctx.lineTo(top.x, top.y - 6);
            ctx.moveTo(bottom.x, bottom.y);
            ctx.lineTo(bottom.x, bottom.y + 6);
            ctx.stroke();

            const distanceFromWest = Math.round(x + halfW);
            if (distanceFromWest % labelSpacing === 0) {
                ctx.fillText(`${distanceFromWest}"`, top.x + 2, top.y - 10);
                ctx.fillText(`${distanceFromWest}"`, bottom.x + 2, bottom.y + 12);
            }
        }

        // Horizontal ticks and labels
        ctx.textAlign = 'right';
        for (let y = -halfH; y <= halfH + 0.01; y += tickSpacing) {
            const left = this.worldToScreen(-halfW, y);
            const right = this.worldToScreen(halfW, y);

            ctx.beginPath();
            ctx.moveTo(left.x, left.y);
            ctx.lineTo(left.x - 6, left.y);
            ctx.moveTo(right.x, right.y);
            ctx.lineTo(right.x + 6, right.y);
            ctx.stroke();

            const distanceFromSouth = Math.round(y + halfH);
            if (distanceFromSouth % labelSpacing === 0) {
                ctx.fillText(`${distanceFromSouth}"`, left.x - 8, left.y);
                ctx.textAlign = 'left';
                ctx.fillText(`${distanceFromSouth}"`, right.x + 8, right.y);
                ctx.textAlign = 'right';
            }
        }

        // Center lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        const midLeft = this.worldToScreen(-halfW, 0);
        const midRight = this.worldToScreen(halfW, 0);
        ctx.beginPath();
        ctx.moveTo(midLeft.x, midLeft.y);
        ctx.lineTo(midRight.x, midRight.y);
        ctx.stroke();

        const midTop = this.worldToScreen(0, halfH);
        const midBottom = this.worldToScreen(0, -halfH);
        ctx.beginPath();
        ctx.moveTo(midTop.x, midTop.y);
        ctx.lineTo(midBottom.x, midBottom.y);
        ctx.stroke();

        ctx.restore();
    }

    highlightPocketsForSelection(pockets: Array<{ id: string; label: string; center: { x: number; y: number } }>) {
        const ctx = this.uiCtx;
        if (!ctx) return;

        // Time-based pulsing effect
        const time = Date.now() / 1000;
        const pulseScale = 0.85 + Math.sin(time * 3) * 0.15;

        pockets.forEach(pocket => {
            // Convert world coordinates to screen coordinates
            const screenPos = this.worldToScreen(pocket.center.x, pocket.center.y);
            if (!screenPos) return;

            // Draw outer glow
            const glowRadius = 40 * pulseScale;
            const gradient = ctx.createRadialGradient(
                screenPos.x, screenPos.y, 0,
                screenPos.x, screenPos.y, glowRadius
            );
            gradient.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
            gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // Draw inner circle
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, 25 * pulseScale, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    highlightCalledPocket(pocket: { id: string; label: string; center: { x: number; y: number } }) {
        const ctx = this.uiCtx;
        if (!ctx) return;

        // Convert world coordinates to screen coordinates
        const screenPos = this.worldToScreen(pocket.center.x, pocket.center.y);
        if (!screenPos) return;

        // Time-based gentle pulsing
        const time = Date.now() / 1000;
        const pulseScale = 0.9 + Math.sin(time * 2) * 0.1;

        // Draw outer glow (green to indicate called/locked pocket)
        const glowRadius = 35 * pulseScale;
        const gradient = ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, glowRadius
        );
        gradient.addColorStop(0, 'rgba(0, 255, 100, 0.5)');
        gradient.addColorStop(0.5, 'rgba(0, 255, 100, 0.25)');
        gradient.addColorStop(1, 'rgba(0, 255, 100, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw inner circle
        ctx.strokeStyle = 'rgba(0, 255, 100, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, 20 * pulseScale, 0, Math.PI * 2);
        ctx.stroke();

        // Draw checkmark icon
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(screenPos.x - 8, screenPos.y);
        ctx.lineTo(screenPos.x - 3, screenPos.y + 5);
        ctx.lineTo(screenPos.x + 8, screenPos.y - 6);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}
