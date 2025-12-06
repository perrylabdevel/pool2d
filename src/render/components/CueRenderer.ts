import * as THREE from 'three';
import { CONFIG } from '../../config';
import { Ball } from '../../physics/Shapes';
import { PredictionResult, ShotPreviewPaths } from '../../physics/Prediction';
import { MicroDialRenderState } from '../ControlTypes';
import { getTableGeometry, type Vec2 } from '../../geometry/Geometry';
import {
    parseHexColor,
    lightenColor,
    toRgba,
    darkenColor,
    classifyAxisAlignmentFromVector,
    getAxisPalette,
    type AxisAlignment
} from '../RenderUtils';
import { ColorTokens } from '../../ui/theme/ColorTokens';
import { LayoutConstants } from '../../ui/theme/LayoutConstants';

const EMPTY_CHIP_BORDER = ColorTokens.border.emphasis;

export class CueRenderer {
    // 3D objects to remove if present (legacy cleanup)
    private cueStick: THREE.Group | null = null;
    private aimLine: THREE.Line | null = null;
    private ghostBall: THREE.Mesh | null = null;
    private trajectoryLines: THREE.Line[] = [];

    constructor(
        private uiCtx: CanvasRenderingContext2D,
        private scene: THREE.Scene,
        private worldToScreen: (x: number, y: number) => { x: number; y: number },
        private getScale: () => number,
        private getUiCanvas: () => HTMLCanvasElement
    ) { }

    drawCueAndPowerBar(
        ball: Ball,
        angle: number,
        power: number,
        showGhost: boolean,
        showPowerBar: boolean,
        isAimMode: boolean,
        prediction?: PredictionResult,
        microDialState?: MicroDialRenderState,
        alpha: number = 1.0
    ) {
        // Remove old 3D elements if they exist
        if (this.cueStick) {
            this.scene.remove(this.cueStick);
            this.cueStick = null;
        }
        if (this.aimLine) {
            this.scene.remove(this.aimLine);
            this.aimLine = null;
        }
        if (this.ghostBall) {
            this.scene.remove(this.ghostBall);
            this.ghostBall = null;
        }

        // Draw power bar and micro dial first (UI layer), so cue/aim sit above
        if (showPowerBar) {
            this.drawPowerBar2D(power, isAimMode, microDialState);
        }

        // Draw cue stick in 2D (clamped to play area so it doesn't clip off-canvas)
        const cueLength = CONFIG.CUE_LENGTH_IN ?? 20;
        // As power increases, cue pulls back away from ball (not toward it)
        const cueDistance = ball.radius + 2 + (power / CONFIG.CUE_POWER_MAX) * 3;

        // Interpolate ball position to match rendered ball position
        const ballX = ball.prevX + (ball.x - ball.prevX) * alpha;
        const ballY = ball.prevY + (ball.y - ball.prevY) * alpha;

        // Raw endpoints in world space (behind the ball opposite shot direction)
        const rawNear = { x: ballX - Math.cos(angle) * cueDistance, y: ballY - Math.sin(angle) * cueDistance };
        const rawFar = { x: ballX - Math.cos(angle) * (cueDistance + cueLength), y: ballY - Math.sin(angle) * (cueDistance + cueLength) };

        // Do NOT clamp to rails — allow cue to extend into padded world area without clipping
        const cueStart = this.worldToScreen(rawNear.x, rawNear.y);
        const cueEnd = this.worldToScreen(rawFar.x, rawFar.y);

        // Scale cue thickness with world scale (about 1 inch diameter in world units)
        const scale = this.getScale();
        const cueThicknessInches = LayoutConstants.Cue.ThicknessInches;
        const cueThicknessPixels = cueThicknessInches * scale;

        // Calculate tip position (about 0.4 inches from the near end - slightly exaggerated for visibility)
        const tipLengthInches = LayoutConstants.Cue.TipLengthInches;
        const tipEnd = {
            x: ballX - Math.cos(angle) * cueDistance,
            y: ballY - Math.sin(angle) * cueDistance
        };
        const tipStart = {
            x: ballX - Math.cos(angle) * (cueDistance + tipLengthInches),
            y: ballY - Math.sin(angle) * (cueDistance + tipLengthInches)
        };
        const tipStartScreen = this.worldToScreen(tipStart.x, tipStart.y);
        const tipEndScreen = this.worldToScreen(tipEnd.x, tipEnd.y);

        // Get cue colors from settings
        const cueStickColor = (CONFIG as any).CUE_STICK_COLOR || ColorTokens.cue.defaultStick;
        const cueTipColor = (CONFIG as any).CUE_TIP_COLOR || ColorTokens.cue.defaultTip;

        // Draw main cue stick with gradient shading for 3D effect
        const lineWidth = Math.max(LayoutConstants.Cue.MinThicknessPixels, cueThicknessPixels);

        // Create gradient perpendicular to cue direction for cylindrical appearance
        const dx = cueEnd.x - tipStartScreen.x;
        const dy = cueEnd.y - tipStartScreen.y;
        const length = Math.hypot(dx, dy);

        if (length > 0) {
            // Create radial-like gradient effect by drawing multiple passes
            // Shadow/dark side
            this.uiCtx.strokeStyle = this.shadeColor(cueStickColor, -0.4);
            this.uiCtx.lineWidth = lineWidth;
            this.uiCtx.lineCap = 'butt';
            this.uiCtx.beginPath();
            this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
            this.uiCtx.lineTo(cueEnd.x, cueEnd.y);
            this.uiCtx.stroke();

            // Mid-tone
            this.uiCtx.strokeStyle = cueStickColor;
            this.uiCtx.lineWidth = lineWidth * 0.7;
            this.uiCtx.lineCap = 'butt';
            this.uiCtx.beginPath();
            this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
            this.uiCtx.lineTo(cueEnd.x, cueEnd.y);
            this.uiCtx.stroke();

            // Highlight (top edge)
            this.uiCtx.strokeStyle = this.shadeColor(cueStickColor, 0.3);
            this.uiCtx.lineWidth = lineWidth * 0.3;
            this.uiCtx.lineCap = 'butt';
            this.uiCtx.beginPath();
            this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
            this.uiCtx.lineTo(cueEnd.x, cueEnd.y);
            this.uiCtx.stroke();

            // Crisp guide along cue centerline so the shaft always visually points at the cue ball
            this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            this.uiCtx.lineWidth = Math.max(1, lineWidth * 0.18);
            this.uiCtx.lineCap = 'butt';
            this.uiCtx.beginPath();
            this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
            this.uiCtx.lineTo(cueEnd.x, cueEnd.y);
            this.uiCtx.stroke();
        }

        // Draw tip with gradient shading
        const tipWidth = Math.max(3, cueThicknessPixels * 0.9);

        // Tip shadow
        this.uiCtx.strokeStyle = this.shadeColor(cueTipColor, -0.3);
        this.uiCtx.lineWidth = tipWidth;
        this.uiCtx.lineCap = 'butt';
        this.uiCtx.beginPath();
        this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
        this.uiCtx.lineTo(tipEndScreen.x, tipEndScreen.y);
        this.uiCtx.stroke();

        // Tip mid-tone
        this.uiCtx.strokeStyle = cueTipColor;
        this.uiCtx.lineWidth = tipWidth * 0.6;
        this.uiCtx.lineCap = 'butt';
        this.uiCtx.beginPath();
        this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
        this.uiCtx.lineTo(tipEndScreen.x, tipEndScreen.y);
        this.uiCtx.stroke();

        // Tip highlight
        this.uiCtx.strokeStyle = this.shadeColor(cueTipColor, 0.4);
        this.uiCtx.lineWidth = tipWidth * 0.25;
        this.uiCtx.lineCap = 'butt';
        this.uiCtx.beginPath();
        this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
        this.uiCtx.lineTo(tipEndScreen.x, tipEndScreen.y);
        this.uiCtx.stroke();

        // Draw aim line in 2D - clipped to contact point or rails
        let aimEndX = ball.x + Math.cos(angle) * CONFIG.AIM_LINE_LENGTH;
        let aimEndY = ball.y + Math.sin(angle) * CONFIG.AIM_LINE_LENGTH;

        // If we have a prediction, stop at the ghost ball center (includes offset)
        if (prediction && prediction.type === 'ball') {
            // Calculate ghost ball position with offset
            const offsetDir = Math.atan2(
                prediction.contactPoint.y - ball.y,
                prediction.contactPoint.x - ball.x
            );
            aimEndX = prediction.contactPoint.x + Math.cos(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
            aimEndY = prediction.contactPoint.y + Math.sin(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
        } else if (prediction && prediction.type === 'rail') {
            aimEndX = prediction.contactPoint.x;
            aimEndY = prediction.contactPoint.y;
        } else {
            // Clip to rails if no prediction
            const aimEndRaw = { x: aimEndX, y: aimEndY };
            const clipped = this.clipLineAtRails({ x: ball.x, y: ball.y }, aimEndRaw);
            aimEndX = clipped.x;
            aimEndY = clipped.y;
        }

        const aimEnd = this.worldToScreen(aimEndX, aimEndY);

        // Start aim line at configured distance from the edge of the cue ball
        const offsetDistance = ball.radius + CONFIG.AIM_LINE_OFFSET;
        const aimStartX = ball.x + Math.cos(angle) * offsetDistance;
        const aimStartY = ball.y + Math.sin(angle) * offsetDistance;
        const aimStart = this.worldToScreen(aimStartX, aimStartY);

        if (showGhost) {
            // Aim assist enabled: solid white with black glow
            // Draw black glow (outer)
            this.uiCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            this.uiCtx.lineWidth = 7;
            this.uiCtx.lineCap = 'round';
            this.uiCtx.beginPath();
            this.uiCtx.moveTo(aimStart.x, aimStart.y);
            this.uiCtx.lineTo(aimEnd.x, aimEnd.y);
            this.uiCtx.stroke();

            // Draw solid white line (inner)
            this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
            this.uiCtx.lineWidth = 3;
            this.uiCtx.lineCap = 'round';
            this.uiCtx.beginPath();
            this.uiCtx.moveTo(aimStart.x, aimStart.y);
            this.uiCtx.lineTo(aimEnd.x, aimEnd.y);
            this.uiCtx.stroke();
        } else {
            // No aim assist: simple dashed line
            this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.uiCtx.lineWidth = 1;
            this.uiCtx.setLineDash([5, 5]);
            this.uiCtx.beginPath();
            this.uiCtx.moveTo(aimStart.x, aimStart.y);
            this.uiCtx.lineTo(aimEnd.x, aimEnd.y);
            this.uiCtx.stroke();
            this.uiCtx.setLineDash([]);
        }

        // Draw ghost ball in 2D if prediction exists
        if (showGhost && prediction && prediction.type === 'ball' && prediction.hitBall) {
            // Ghost ball center with configurable offset from contact point
            // Positive offset = away from cue ball, negative = toward cue ball
            const offsetDir = Math.atan2(
                prediction.contactPoint.y - ball.y,
                prediction.contactPoint.x - ball.x
            );
            const ghostX = prediction.contactPoint.x + Math.cos(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
            const ghostY = prediction.contactPoint.y + Math.sin(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
            const ghostScreen = this.worldToScreen(ghostX, ghostY);

            // Draw ghost ball with black glow + white outline (matching path styling)
            // Draw black glow (outer)
            this.uiCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            this.uiCtx.lineWidth = 4;
            this.uiCtx.lineCap = 'round';
            const ghostRadius = Math.abs(ball.radius * scale);
            if (ghostRadius > 0) {
                this.uiCtx.beginPath();
                this.uiCtx.arc(ghostScreen.x, ghostScreen.y, ghostRadius, 0, Math.PI * 2);
                this.uiCtx.stroke();

                // Draw solid white circle (inner)
                this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
                this.uiCtx.lineWidth = 2;
                this.uiCtx.lineCap = 'round';
                this.uiCtx.beginPath();
                this.uiCtx.arc(ghostScreen.x, ghostScreen.y, ghostRadius, 0, Math.PI * 2);
                this.uiCtx.stroke();
            }
        }

        // Draw aim info overlay (only if scale > 0)
        if (CONFIG.SHOW_AIM_INFO && CONFIG.AIM_INFO_SCALE > 0) {
            this.drawAimInfo(ball, angle, power, prediction);
        }
    }

    drawPowerBar2D(power: number, isAimMode: boolean, microDialState?: MicroDialRenderState) {
        const { width: barWidth, height: barHeight } = this.getSidebarSize();
        const { powerSide } = this.getSidebarSides();
        const rect = this.getSideBarRect(powerSide, barWidth, barHeight);
        const barX = rect.x;
        const barY = rect.y;
        const ctx = this.uiCtx;
        const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
            const radius = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        };

        // Background with subtle plate behind the color fill plus inner padding
        ctx.fillStyle = 'rgba(28, 32, 39, 0.65)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        const innerPadding = Math.max(3, barWidth * 0.08);
        const innerX = barX + innerPadding;
        const innerY = barY + innerPadding;
        const innerWidth = barWidth - innerPadding * 2;
        const innerHeight = barHeight - innerPadding * 2;

        // Power gradient is fully filled; motion is communicated via cue overlay
        const powerPercent = Math.max(0, Math.min(1, power / CONFIG.CUE_POWER_MAX));
        const gradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
        gradient.addColorStop(0, 'rgba(255, 230, 109, 0.85)');
        gradient.addColorStop(0.6, 'rgba(255, 155, 47, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 59, 48, 0.75)');
        ctx.fillStyle = gradient;
        ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

        // Cue overlay: clipped so the shaft slides downward as power increases
        const cueLaneWidth = innerWidth / 1.5; // keep cue visuals similar size while bar widens
        const cueWidth = Math.max(3, cueLaneWidth * 0.5);
        const cueLength = innerHeight * 3.0;
        const cueX = innerX + (innerWidth - cueWidth) / 2;
        const ferruleHeight = Math.max(4, cueWidth * 0.3);
        const tipHeight = Math.max(4, cueWidth * 0.25);
        const cueTopMin = innerY + 10;
        const cueTopMax = innerY + innerHeight - tipHeight - 6;
        const cueTravel = Math.max(0, cueTopMax - cueTopMin);
        const cueY = cueTopMin + cueTravel * powerPercent;
        const adjustedCueLength = cueLength;

        ctx.save();
        ctx.beginPath();
        ctx.rect(innerX, innerY, innerWidth, innerHeight);
        ctx.clip();

        const cueStickHex = (CONFIG as any).CUE_STICK_COLOR || '#8B4513';
        const cueStickRGB = parseHexColor(cueStickHex);
        const cueStickBright = toRgba(lightenColor(cueStickRGB, 0.25), 1);
        const cueStickMid = toRgba(cueStickRGB, 1);
        const cueStickShadow = toRgba(darkenColor(cueStickRGB, 0.25), 1);

        const buttWidth = cueWidth;
        const tipWidthInner = Math.max(2, cueWidth * 0.45);
        const tipOffset = (buttWidth - tipWidthInner) / 2;

        // Draw cue core with tapered polygon
        ctx.fillStyle = cueStickMid;
        ctx.beginPath();
        ctx.moveTo(cueX + tipOffset, cueY);
        ctx.lineTo(cueX + tipOffset + tipWidthInner, cueY);
        ctx.lineTo(cueX + buttWidth, cueY + adjustedCueLength);
        ctx.lineTo(cueX, cueY + adjustedCueLength);
        ctx.closePath();
        ctx.fill();

        // Highlight and shadow trims for cylindrical feel along the taper
        ctx.fillStyle = cueStickBright;
        ctx.beginPath();
        ctx.moveTo(cueX + tipOffset + tipWidthInner * 0.2, cueY);
        ctx.lineTo(cueX + tipOffset + tipWidthInner * 0.5, cueY);
        ctx.lineTo(cueX + buttWidth * 0.55, cueY + adjustedCueLength);
        ctx.lineTo(cueX + buttWidth * 0.35, cueY + adjustedCueLength);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = cueStickShadow;
        ctx.beginPath();
        ctx.moveTo(cueX + tipOffset + tipWidthInner * 0.75, cueY);
        ctx.lineTo(cueX + tipOffset + tipWidthInner, cueY);
        ctx.lineTo(cueX + buttWidth, cueY + adjustedCueLength);
        ctx.lineTo(cueX + buttWidth * 0.8, cueY + adjustedCueLength);
        ctx.closePath();
        ctx.fill();

        // Glow outline to keep cue visible over the heatmap gradient
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(cueX + tipOffset, cueY);
        ctx.lineTo(cueX + tipOffset + tipWidthInner, cueY);
        ctx.lineTo(cueX + buttWidth, cueY + adjustedCueLength);
        ctx.lineTo(cueX, cueY + adjustedCueLength);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Cue ferrule + tip
        ctx.fillStyle = '#f7f0d2';
        ctx.fillRect(cueX + tipOffset, cueY, tipWidthInner, ferruleHeight);
        const cueTipHex = (CONFIG as any).CUE_TIP_COLOR || '#4A90E2';
        const cueTipRGB = parseHexColor(cueTipHex);
        ctx.fillStyle = toRgba(cueTipRGB, 1);
        ctx.fillRect(cueX + tipOffset, cueY - tipHeight, tipWidthInner, tipHeight);

        ctx.restore();

        // Border adopts the empty ball chip outline color for consistency
        ctx.strokeStyle = EMPTY_CHIP_BORDER;
        ctx.lineWidth = isAimMode ? 1 : 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        const metallicGradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
        metallicGradient.addColorStop(0, 'rgba(196, 208, 214, 0.85)');
        metallicGradient.addColorStop(0.5, 'rgba(126, 140, 148, 0.9)');
        metallicGradient.addColorStop(1, 'rgba(212, 219, 224, 0.85)');
        ctx.strokeStyle = metallicGradient;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(innerX, innerY, innerWidth, innerHeight);

        // Power readout badge below the bar
        const labelHeight = Math.max(18, innerPadding * 2.2);
        const labelWidth = barWidth + innerPadding * 1.6;
        const labelX = barX - innerPadding * 0.8;
        const labelY = barY + barHeight + 6;
        ctx.fillStyle = 'rgba(8, 10, 14, 0.82)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        drawRoundedRect(labelX, labelY, labelWidth, labelHeight, 5);
        ctx.fill();
        ctx.stroke();
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#f2f2f2';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(powerPercent * 100)}%`, labelX + labelWidth / 2, labelY + labelHeight / 2);

        this.drawMicroDial2D(microDialState);
    }

    private drawMicroDial2D(state?: MicroDialRenderState) {
        const { width: barWidth, height: barHeight } = this.getSidebarSize();
        const { dialSide } = this.getSidebarSides();
        const rect = this.getSideBarRect(dialSide, barWidth, barHeight);
        const barX = rect.x;
        const barY = rect.y;
        const ctx = this.uiCtx;
        const value = Math.max(-1, Math.min(1, state?.value ?? 0));
        const isActive = state?.isActive ?? false;
        const handlePercent = 0.5 - (value * 0.5);
        const handleY = barY + handlePercent * barHeight;
        const centerY = barY + barHeight / 2;
        const handleX = barX + barWidth / 2;

        ctx.save();
        ctx.fillStyle = 'rgba(28, 32, 39, 0.65)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        const innerPadding = Math.max(3, barWidth * 0.08);
        const innerX = barX + innerPadding;
        const innerY = barY + innerPadding;
        const innerWidth = barWidth - innerPadding * 2;
        const innerHeight = barHeight - innerPadding * 2;

        ctx.strokeStyle = EMPTY_CHIP_BORDER;
        ctx.lineWidth = isActive ? 2 : 1.5;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        const dialMetallic = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
        dialMetallic.addColorStop(0, 'rgba(196, 208, 214, 0.85)');
        dialMetallic.addColorStop(0.5, 'rgba(126, 140, 148, 0.9)');
        dialMetallic.addColorStop(1, 'rgba(212, 219, 224, 0.85)');
        ctx.strokeStyle = dialMetallic;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(innerX, innerY, innerWidth, innerHeight);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(barX + 4, centerY);
        ctx.lineTo(barX + barWidth - 4, centerY);
        ctx.stroke();

        for (let i = 1; i <= 2; i++) {
            const offset = i * (barHeight / 6);
            ctx.beginPath();
            ctx.moveTo(barX + 6, centerY - offset);
            ctx.lineTo(barX + barWidth - 6, centerY - offset);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(barX + 6, centerY + offset);
            ctx.lineTo(barX + barWidth - 6, centerY + offset);
            ctx.stroke();
        }

        if (Math.abs(value) > 0.01) {
            const fromY = value > 0 ? handleY : centerY;
            const toY = value > 0 ? centerY : handleY;
            const gradient = ctx.createLinearGradient(barX, fromY, barX, toY);
            if (value > 0) {
                gradient.addColorStop(0, 'rgba(111, 202, 255, 0.8)');
                gradient.addColorStop(1, 'rgba(111, 202, 255, 0.1)');
            } else {
                gradient.addColorStop(0, 'rgba(255, 138, 101, 0.8)');
                gradient.addColorStop(1, 'rgba(255, 138, 101, 0.1)');
            }
            ctx.fillStyle = gradient;
            ctx.fillRect(innerX + 2, Math.min(fromY, toY), innerWidth - 4, Math.abs(toY - fromY));
        }

        const handleRadius = barWidth / 2 - 6;
        ctx.beginPath();
        ctx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#fff59d' : '#ffd54f';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(handleX, handleY - handleRadius + 4);
        ctx.lineTo(handleX, handleY + handleRadius - 4);
        ctx.stroke();

        ctx.restore();
    }

    drawAimInfo(ball: Ball, angle: number, power: number, prediction?: PredictionResult) {
        const ctx = this.uiCtx;
        const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
            const radius = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        };

        // Calculate values
        let angleDeg = (angle * 180 / Math.PI) % 360;
        if (angleDeg < 0) angleDeg += 360;

        const velocity = power * CONFIG.CUE_POWER_MULTIPLIER;
        const distanceText = prediction && prediction.type !== 'none' ? `${prediction.distance.toFixed(1)}"` : '';

        let cutAngleText = '';
        if (prediction && prediction.type === 'ball' && prediction.hitBall) {
            const targetBall = prediction.hitBall;
            const toBallAngle = Math.atan2(targetBall.y - ball.y, targetBall.x - ball.x);
            let cutAngle = Math.abs(angle - toBallAngle) * 180 / Math.PI;
            if (cutAngle > 90) cutAngle = 180 - cutAngle;
            cutAngleText = `${cutAngle.toFixed(1)}°`;
        }

        const metrics: Array<{ icon: string; value: string; color: string }> = [
            { icon: '⟲', value: `${angleDeg.toFixed(1)}°`, color: '#4fc3f7' }
        ];
        if (distanceText) {
            metrics.push({
                icon: '↔',
                value: cutAngleText ? `${distanceText} · ${cutAngleText}` : distanceText,
                color: cutAngleText ? '#9c6cff' : '#66bb6a'
            });
        }

        // Position badges on the upper-left frame, laid out in a single row past the pocket
        const geom = getTableGeometry();
        const frameTop = geom.frameOutline.outerHalfHeight;
        const frameLeft = -geom.frameOutline.outerHalfWidth;
        const topLeft = this.worldToScreen(frameLeft, frameTop);

        const badgeHeight = 26 * CONFIG.AIM_INFO_SCALE;
        const horizontalPadding = 10 * CONFIG.AIM_INFO_SCALE;
        const iconSpacing = 6 * CONFIG.AIM_INFO_SCALE;
        const inset = 14 * CONFIG.AIM_INFO_SCALE;
        const topOffset = 16 * CONFIG.AIM_INFO_SCALE;
        const pocketClearPx = 100 * CONFIG.AIM_INFO_SCALE;
        const badgeGap = 8 * CONFIG.AIM_INFO_SCALE;

        const measureBadge = (metric: { icon: string; value: string }) => {
            ctx.font = `bold ${14 * CONFIG.AIM_INFO_SCALE}px Arial`;
            const iconWidth = ctx.measureText(metric.icon).width;
            ctx.font = `bold ${12 * CONFIG.AIM_INFO_SCALE}px monospace`;
            const valueWidth = ctx.measureText(metric.value).width;
            const width = horizontalPadding * 2 + iconWidth + iconSpacing + valueWidth;
            return { width, iconWidth, valueWidth };
        };

        const measurements = metrics.map(measureBadge);

        let cursorX = topLeft.x + inset + pocketClearPx;
        metrics.forEach((metric, i) => {
            const { width, iconWidth } = measurements[i];
            const center = {
                x: cursorX + width / 2,
                y: topLeft.y + topOffset + badgeHeight / 2
            };
            cursorX += width + badgeGap;
            const x = center.x - width / 2;
            const y = center.y - badgeHeight / 2;

            const gradient = ctx.createLinearGradient(x, y, x, y + badgeHeight);
            gradient.addColorStop(0, 'rgba(18, 20, 28, 0.92)');
            gradient.addColorStop(1, 'rgba(12, 14, 20, 0.96)');
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            drawRoundedRect(x - 2, y - 2, width + 4, badgeHeight + 4, 8 * CONFIG.AIM_INFO_SCALE);
            ctx.fill();
            ctx.fillStyle = gradient;
            drawRoundedRect(x, y, width, badgeHeight, 8 * CONFIG.AIM_INFO_SCALE);
            ctx.fill();
            ctx.strokeStyle = metric.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = `bold ${14 * CONFIG.AIM_INFO_SCALE}px Arial`;
            ctx.fillStyle = metric.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const iconX = x + horizontalPadding;
            const textY = center.y;
            ctx.fillText(metric.icon, iconX, textY);

            ctx.font = `bold ${12 * CONFIG.AIM_INFO_SCALE}px monospace`;
            ctx.fillStyle = '#ffffff';
            const valueX = iconX + iconWidth + iconSpacing;
            ctx.fillText(metric.value, valueX, textY);
        });
    }

    drawSimpleMathTrajectoryLines(
        prediction: PredictionResult,
        cueBallPos: { x: number; y: number },
        shotDirection: { x: number; y: number },
        predictor: any
    ) {
        if (prediction.type === 'none') return;

        // Calculate shot complexity for adaptive path length
        let pathLengthMultiplier = 1.0;
        if (prediction.type === 'ball' && prediction.contactNormal) {
            const dot = shotDirection.x * prediction.contactNormal.x + shotDirection.y * prediction.contactNormal.y;
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
            const normalizedAngle = angle / (Math.PI / 2);
            pathLengthMultiplier = 1.0 - (normalizedAngle * 0.7);
        }

        const baseLength = 50;
        const adjustedLength = baseLength * pathLengthMultiplier * CONFIG.OBJECT_PATH_PERCENTAGE;

        const trajectories = predictor.predictTrajectories(
            prediction,
            cueBallPos,
            shotDirection,
            adjustedLength
        );

        const drawLineWithGlow = (
            start: { x: number; y: number },
            end: { x: number; y: number },
            glowColor: string,
            lineColor: string,
            lineWidth: number
        ) => {
            const startScreen = this.worldToScreen(start.x, start.y);
            const endScreen = this.worldToScreen(end.x, end.y);

            this.uiCtx.strokeStyle = glowColor;
            this.uiCtx.lineWidth = lineWidth + 4;
            this.uiCtx.lineCap = 'round';
            this.uiCtx.beginPath();
            this.uiCtx.moveTo(startScreen.x, startScreen.y);
            this.uiCtx.lineTo(endScreen.x, endScreen.y);
            this.uiCtx.stroke();

            this.uiCtx.strokeStyle = lineColor;
            this.uiCtx.lineWidth = lineWidth;
            this.uiCtx.lineCap = 'round';
            this.uiCtx.beginPath();
            this.uiCtx.moveTo(startScreen.x, startScreen.y);
            this.uiCtx.lineTo(endScreen.x, endScreen.y);
            this.uiCtx.stroke();

            return { startScreen, endScreen };
        };

        if (trajectories.objectBallPath) {
            const dirX = trajectories.objectBallPath.end.x - trajectories.objectBallPath.start.x;
            const dirY = trajectories.objectBallPath.end.y - trajectories.objectBallPath.start.y;
            const length = Math.sqrt(dirX * dirX + dirY * dirY);

            if (length > 0.0001) {
                const normX = dirX / length;
                const normY = dirY / length;
                const start = { x: prediction.hitBall!.x, y: prediction.hitBall!.y };
                const endRaw = { x: start.x + normX * adjustedLength, y: start.y + normY * adjustedLength };
                const end = this.clipLineAtRails(start, endRaw);

                const orientation = classifyAxisAlignmentFromVector(normX, normY);
                const palette = getAxisPalette(orientation);

                drawLineWithGlow(
                    start,
                    end,
                    palette.glow,
                    palette.line,
                    3
                );
            }
        }

        if (trajectories.cueBallPath) {
            const dirX = trajectories.cueBallPath.end.x - trajectories.cueBallPath.start.x;
            const dirY = trajectories.cueBallPath.end.y - trajectories.cueBallPath.start.y;
            const length = Math.sqrt(dirX * dirX + dirY * dirY);

            if (length > 0.0001) {
                const normX = dirX / length;
                const normY = dirY / length;
                let startX, startY;
                if (prediction.type === 'ball') {
                    const offsetDir = Math.atan2(
                        prediction.contactPoint.y - cueBallPos.y,
                        prediction.contactPoint.x - cueBallPos.x
                    );
                    startX = prediction.contactPoint.x + Math.cos(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
                    startY = prediction.contactPoint.y + Math.sin(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
                } else {
                    startX = prediction.contactPoint.x;
                    startY = prediction.contactPoint.y;
                }
                const start = { x: startX, y: startY };
                const cueBallLength = adjustedLength * 0.25;
                const endRaw = { x: start.x + normX * cueBallLength, y: start.y + normY * cueBallLength };
                const end = this.clipLineAtRails(start, endRaw);

                drawLineWithGlow(
                    start,
                    end,
                    'rgba(0, 0, 0, 0.8)',
                    'rgba(255, 255, 255, 0.95)',
                    3
                );
            }
        }
    }

    drawPhysicsTrajectoryLines(shotPaths: ShotPreviewPaths, cueBallPos: { x: number; y: number }, debugMode: boolean = false) {
        this.trajectoryLines.forEach(line => this.scene.remove(line));
        this.trajectoryLines = [];

        if (!shotPaths.firstContact || shotPaths.cuePath.length < 2) return;

        if (debugMode) {
            this.uiCtx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
            this.uiCtx.lineWidth = 1;
            this.uiCtx.setLineDash([5, 5]);
            this.uiCtx.beginPath();

            for (let i = 0; i < shotPaths.cuePath.length; i++) {
                const point = shotPaths.cuePath[i];
                const screen = this.worldToScreen(point.x, point.y);

                if (i === 0) {
                    this.uiCtx.moveTo(screen.x, screen.y);
                } else {
                    this.uiCtx.lineTo(screen.x, screen.y);
                }

                if (shotPaths.firstContact && i > 0) {
                    const prevPoint = shotPaths.cuePath[i - 1];
                    const contactDist = Math.hypot(
                        shotPaths.firstContact.contactPoint.x - prevPoint.x,
                        shotPaths.firstContact.contactPoint.y - prevPoint.y
                    );
                    const segmentDist = Math.hypot(point.x - prevPoint.x, point.y - prevPoint.y);

                    if (contactDist <= segmentDist) {
                        break;
                    }
                }
            }

            this.uiCtx.stroke();
            this.uiCtx.setLineDash([]);
        }

        const drawPathWithGlow = (path: Vec2[], glowColor: string, lineColor: string, lineWidth: number) => {
            if (path.length < 2) return;

            this.uiCtx.strokeStyle = glowColor;
            this.uiCtx.lineWidth = lineWidth + 4;
            this.uiCtx.lineCap = 'round';
            this.uiCtx.lineJoin = 'round';
            this.uiCtx.beginPath();

            for (let i = 0; i < path.length; i++) {
                const point = path[i];
                const screen = this.worldToScreen(point.x, point.y);

                if (i === 0) {
                    this.uiCtx.moveTo(screen.x, screen.y);
                } else {
                    this.uiCtx.lineTo(screen.x, screen.y);
                }
            }

            this.uiCtx.stroke();

            this.uiCtx.strokeStyle = lineColor;
            this.uiCtx.lineWidth = lineWidth;
            this.uiCtx.lineCap = 'round';
            this.uiCtx.lineJoin = 'round';
            this.uiCtx.beginPath();

            for (let i = 0; i < path.length; i++) {
                const point = path[i];
                const screen = this.worldToScreen(point.x, point.y);

                if (i === 0) {
                    this.uiCtx.moveTo(screen.x, screen.y);
                } else {
                    this.uiCtx.lineTo(screen.x, screen.y);
                }
            }

            this.uiCtx.stroke();
        };

        let pathLengthMultiplier = 1.0;
        if (!debugMode && shotPaths.firstContact?.type === 'ball') {
            const contactIdx = shotPaths.cuePath.findIndex((p, i) => {
                if (i === 0) return false;
                const prev = shotPaths.cuePath[i - 1];
                const dist = Math.hypot(
                    shotPaths.firstContact!.contactPoint.x - prev.x,
                    shotPaths.firstContact!.contactPoint.y - prev.y
                );
                return dist < 0.5;
            });

            if (contactIdx > 0) {
                const cueDir = {
                    x: shotPaths.cuePath[contactIdx].x - shotPaths.cuePath[0].x,
                    y: shotPaths.cuePath[contactIdx].y - shotPaths.cuePath[0].y
                };
                const cueDirLen = Math.hypot(cueDir.x, cueDir.y);

                if (cueDirLen > 0.001) {
                    cueDir.x /= cueDirLen;
                    cueDir.y /= cueDirLen;
                    const normal = shotPaths.firstContact.contactNormal;
                    const dot = cueDir.x * normal.x + cueDir.y * normal.y;
                    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                    const normalizedAngle = angle / (Math.PI / 2);
                    pathLengthMultiplier = 1.0 - (normalizedAngle * 0.8);
                }
            }
        }

        shotPaths.objectPaths.forEach((path, ballId) => {
            if (path.length < 2) return;
            if (!debugMode && ballId !== shotPaths.firstContact?.hitBall?.id) return;

            let displayPath = path;
            if (!debugMode && pathLengthMultiplier < 1.0) {
                const targetLength = Math.floor(path.length * pathLengthMultiplier);
                displayPath = path.slice(0, Math.max(2, targetLength));
            }

            const orientation = this.classifyAxisAlignmentFromPath(displayPath);
            const palette = getAxisPalette(orientation);

            if (debugMode) {
                this.uiCtx.strokeStyle = palette.debugStroke;
                this.uiCtx.lineWidth = 2;
                this.uiCtx.setLineDash([10, 5]);
                this.uiCtx.beginPath();

                for (let i = 0; i < displayPath.length; i++) {
                    const point = displayPath[i];
                    const screen = this.worldToScreen(point.x, point.y);

                    if (i === 0) {
                        this.uiCtx.moveTo(screen.x, screen.y);
                    } else {
                        this.uiCtx.lineTo(screen.x, screen.y);
                    }
                }

                this.uiCtx.stroke();
                this.uiCtx.setLineDash([]);

                const lastIdx = displayPath.length - 1;
                const endPoint = displayPath[lastIdx];
                const prevPoint = displayPath[lastIdx - 1];
                const endScreen = this.worldToScreen(endPoint.x, endPoint.y);
                const dx = endPoint.x - prevPoint.x;
                const dy = endPoint.y - prevPoint.y;
                const len = Math.sqrt(dx * dx + dy * dy);

                if (len > 0) {
                    const arrowSize = 10;
                    const angle = Math.atan2(dy, dx);

                    this.uiCtx.fillStyle = palette.debugFill;
                    this.uiCtx.beginPath();
                    this.uiCtx.moveTo(endScreen.x, endScreen.y);
                    this.uiCtx.lineTo(
                        endScreen.x - arrowSize * Math.cos(angle - Math.PI / 6),
                        endScreen.y - arrowSize * Math.sin(angle - Math.PI / 6)
                    );
                    this.uiCtx.lineTo(
                        endScreen.x - arrowSize * Math.cos(angle + Math.PI / 6),
                        endScreen.y - arrowSize * Math.sin(angle + Math.PI / 6)
                    );
                    this.uiCtx.closePath();
                    this.uiCtx.fill();
                }
            } else {
                drawPathWithGlow(displayPath, palette.glow, palette.line, 3);
            }
        });

        if (shotPaths.firstContact && shotPaths.cuePath.length > 2) {
            const contactIdx = shotPaths.cuePath.findIndex((p, i) => {
                if (i === 0) return false;
                const prev = shotPaths.cuePath[i - 1];
                const dist = Math.hypot(
                    shotPaths.firstContact!.contactPoint.x - prev.x,
                    shotPaths.firstContact!.contactPoint.y - prev.y
                );
                return dist < 0.5;
            });

            if (contactIdx > 0 && contactIdx < shotPaths.cuePath.length - 1) {
                let cueBallReboundPath = shotPaths.cuePath.slice(contactIdx);

                if (!debugMode && pathLengthMultiplier < 1.0) {
                    const targetLength = Math.floor(cueBallReboundPath.length * pathLengthMultiplier);
                    cueBallReboundPath = cueBallReboundPath.slice(0, Math.max(2, targetLength));
                }

                if (cueBallReboundPath.length >= 2) {
                    if (debugMode) {
                        this.uiCtx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
                        this.uiCtx.lineWidth = 2;
                        this.uiCtx.setLineDash([10, 5]);
                        this.uiCtx.beginPath();

                        for (let i = 0; i < cueBallReboundPath.length; i++) {
                            const point = cueBallReboundPath[i];
                            const screen = this.worldToScreen(point.x, point.y);

                            if (i === 0) {
                                this.uiCtx.moveTo(screen.x, screen.y);
                            } else {
                                this.uiCtx.lineTo(screen.x, screen.y);
                            }
                        }

                        this.uiCtx.stroke();
                        this.uiCtx.setLineDash([]);

                        const lastIdx = cueBallReboundPath.length - 1;
                        const endPoint = cueBallReboundPath[lastIdx];
                        const prevPoint = cueBallReboundPath[lastIdx - 1];
                        const endScreen = this.worldToScreen(endPoint.x, endPoint.y);
                        const dx = endPoint.x - prevPoint.x;
                        const dy = endPoint.y - prevPoint.y;
                        const len = Math.sqrt(dx * dx + dy * dy);

                        if (len > 0) {
                            const arrowSize = 10;
                            const angle = Math.atan2(dy, dx);

                            this.uiCtx.fillStyle = 'rgba(0, 255, 255, 0.9)';
                            this.uiCtx.beginPath();
                            this.uiCtx.moveTo(endScreen.x, endScreen.y);
                            this.uiCtx.lineTo(
                                endScreen.x - arrowSize * Math.cos(angle - Math.PI / 6),
                                endScreen.y - arrowSize * Math.sin(angle - Math.PI / 6)
                            );
                            this.uiCtx.lineTo(
                                endScreen.x - arrowSize * Math.cos(angle + Math.PI / 6),
                                endScreen.y - arrowSize * Math.sin(angle + Math.PI / 6)
                            );
                            this.uiCtx.closePath();
                            this.uiCtx.fill();
                        }
                    } else {
                        drawPathWithGlow(cueBallReboundPath, 'rgba(0, 0, 0, 0.8)', 'rgba(255, 255, 255, 0.95)', 3);
                    }
                }
            }
        }
    }

    private clipLineAtRails(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number } {
        const geom2 = getTableGeometry();
        const halfWidth = geom2.playWidthIn / 2;
        const halfHeight = geom2.playHeightIn / 2;

        const margin = CONFIG.BALL_RADIUS;
        const maxX = halfWidth - margin;
        const maxY = halfHeight - margin;
        const minX = -maxX;
        const minY = -maxY;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len < 0.001) return end;

        const dirX = dx / len;
        const dirY = dy / len;

        let minT = len;

        if (dirX > 0.001) {
            const t = (maxX - start.x) / dirX;
            if (t > 0 && t < minT) minT = t;
        } else if (dirX < -0.001) {
            const t = (minX - start.x) / dirX;
            if (t > 0 && t < minT) minT = t;
        }

        if (dirY > 0.001) {
            const t = (maxY - start.y) / dirY;
            if (t > 0 && t < minT) minT = t;
        } else if (dirY < -0.001) {
            const t = (minY - start.y) / dirY;
            if (t > 0 && t < minT) minT = t;
        }

        return {
            x: start.x + dirX * minT,
            y: start.y + dirY * minT
        };
    }

    private classifyAxisAlignmentFromPath(path: Vec2[]): AxisAlignment {
        if (path.length < 2) return null;
        const start = path[0];
        const end = path[path.length - 1];
        return classifyAxisAlignmentFromVector(end.x - start.x, end.y - start.y);
    }

    private shadeColor(color: string, amount: number): string {
        let r = parseInt(color.slice(1, 3), 16);
        let g = parseInt(color.slice(3, 5), 16);
        let b = parseInt(color.slice(5, 7), 16);

        if (amount > 0) {
            r = Math.round(r + (255 - r) * amount);
            g = Math.round(g + (255 - g) * amount);
            b = Math.round(b + (255 - b) * amount);
        } else {
            r = Math.round(r * (1 + amount));
            g = Math.round(g * (1 + amount));
            b = Math.round(b * (1 + amount));
        }

        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    getPowerBarBounds() {
        const { width, height } = this.getSidebarSize();
        const { powerSide } = this.getSidebarSides();
        const rect = this.getSideBarRect(powerSide, width, height);
        return { x: rect.x, y: rect.y, width, height };
    }

    getMicroDialBounds() {
        const { width, height } = this.getSidebarSize();
        const { dialSide } = this.getSidebarSides();
        const rect = this.getSideBarRect(dialSide, width, height);
        return { x: rect.x, y: rect.y, width, height };
    }

    private getSideBarRect(side: 'left' | 'right', width: number, height: number) {
        const geom = getTableGeometry();
        const frameHalfWidth = geom.frameOutline.outerHalfWidth;
        const frameWorldX = side === 'right' ? frameHalfWidth : -frameHalfWidth;
        const frameScreen = this.worldToScreen(frameWorldX, 0);
        const offsetFromFrame = 20;
        const x = side === 'right' ? frameScreen.x + offsetFromFrame : frameScreen.x - offsetFromFrame - width;
        const bounds = this.getTableFrameScreenBounds();
        let y = bounds.centerY - height / 2;
        const maxY = Math.max(0, this.getUiCanvas().height - height);
        y = Math.max(0, Math.min(maxY, y));
        return { x, y, width, height };
    }

    private getSidebarSides() {
        const dialSide = CONFIG.SIDEBAR_DIAL_SIDE === 'right' ? 'right' : 'left';
        const powerSide = dialSide === 'left' ? 'right' : 'left';
        return { dialSide, powerSide };
    }

    private getSidebarSize() {
        const bounds = this.getTableFrameScreenBounds();
        const height = Math.max(160, bounds.height * 0.75);
        const width = Math.max(36 * 1.5, height * 0.08 * 1.5);
        return { width, height };
    }

    private getTableFrameScreenBounds() {
        const geom = getTableGeometry();
        const halfHeight = geom.frameOutline.outerHalfHeight;
        const topScreen = this.worldToScreen(0, halfHeight).y;
        const bottomScreen = this.worldToScreen(0, -halfHeight).y;
        const top = Math.min(topScreen, bottomScreen);
        const bottom = Math.max(topScreen, bottomScreen);
        const height = Math.abs(bottom - top);
        return { top, bottom, height, centerY: (top + bottom) / 2 };
    }
}
