import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawPanel, drawGlossyButton, drawCurrencyPill, Rect, UIColors } from '../components/UIComponents';
import { SettingsManager } from '../SettingsManager';
import { notificationService } from '../NotificationService';

type ShopButton = {
    id: 'back' | 'equip';
    label: string;
    color: string;
    rect: Rect;
};

type CueCard = {
    id: string;
    name: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    stickColor: string;
    tipColor: string;
    accent: string;
    desc: string;
};

const CUES: CueCard[] = [
    { id: 'default', name: 'Standard Issue', rarity: 'COMMON', stickColor: '#8B4513', tipColor: '#4A90E2', accent: '#F0A35E', desc: 'Reliable and sturdy house cue.' },
    { id: 'midnight', name: 'Midnight Stealth', rarity: 'RARE', stickColor: '#0F111A', tipColor: '#FF3333', accent: '#2B7FFF', desc: 'Matte stealth finish for precision strikes.' },
    { id: 'royal', name: 'Royal Oak', rarity: 'RARE', stickColor: '#5D4037', tipColor: '#FFD700', accent: '#D3A863', desc: 'Polished oak with gold accents.' },
    { id: 'cyber', name: 'Cyber Pulse', rarity: 'EPIC', stickColor: '#00B4FF', tipColor: '#FFFFFF', accent: '#7C5CFF', desc: 'Neon-infused composite material.' },
    { id: 'viper', name: 'Viper Strike', rarity: 'EPIC', stickColor: '#66FF00', tipColor: '#000000', accent: '#7AFF33', desc: 'Toxic finish that glows under low light.' },
    { id: 'inferno', name: 'Dragon\'s Breath', rarity: 'LEGENDARY', stickColor: '#FF3333', tipColor: '#FFD700', accent: '#FF7A18', desc: 'Forged in fire. Handle stays hot.' }
];

export class ShopScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: ShopButton[] = [];
    private hoveredButton: ShopButton | null = null;
    private hoveredCardIndex: number = -1;
    private selectedCardIndex: number = 0;
    private cardRects: Rect[] = [];
    private settingsManager = new SettingsManager();
    private equippedCueId: string = CUES[0].id;

    constructor() {
        this.syncEquippedCue();
    }

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;
        this.syncEquippedCue();
        this.updateLayout();
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.updateLayout);
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('resize', this.updateLayout);
        this.canvas.style.cursor = 'default';
    }

    private updateLayout = () => {
        if (!this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const horizontalPadding = Math.max(40, width * 0.05);
        const footerHeight = 160;

        this.buttons = [
            {
                id: 'back',
                label: '← BACK',
                color: UIColors.danger,
                rect: { x: 20, y: 20, width: 100, height: 40 }
            },
            {
                id: 'equip',
                label: 'Equip Selected',
                color: '#4CAF50',
                rect: {
                    x: width - horizontalPadding - 220,
                    y: height - footerHeight + 60,
                    width: 220,
                    height: 56
                }
            }
        ];

        const cardWidth = 240;
        const cardHeight = 320;
        const gap = 28;
        const columns = Math.max(1, Math.floor((width - horizontalPadding * 2) / (cardWidth + gap)));
        const startX = (width - Math.min(columns, CUES.length) * cardWidth - Math.max(0, Math.min(columns, CUES.length) - 1) * gap) / 2;
        const startY = 180;

        this.cardRects = CUES.map((_cue, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            return {
                x: startX + col * (cardWidth + gap),
                y: startY + row * (cardHeight + gap),
                width: cardWidth,
                height: cardHeight
            };
        });
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        this.hoveredButton = null;
        for (const button of this.buttons) {
            const { x: bx, y: by, width, height } = button.rect;
            const isEquipDisabled = button.id === 'equip' && this.isSelectedCueEquipped();
            if (!isEquipDisabled && x >= bx && x <= bx + width && y >= by && y <= by + height) {
                this.hoveredButton = button;
                break;
            }
        }

        this.hoveredCardIndex = -1;
        this.cardRects.forEach((cardRect, index) => {
            const { x: cx, y: cy, width: cw, height: ch } = cardRect;
            if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
                this.hoveredCardIndex = index;
            }
        });

        const isPointer = Boolean(this.hoveredButton || this.hoveredCardIndex !== -1);
        this.canvas.style.cursor = isPointer ? 'pointer' : 'default';
    };

    private onClick = () => {
        if (this.hoveredButton) {
            this.handleButtonClick(this.hoveredButton.id);
            return;
        }
        if (this.hoveredCardIndex !== -1) {
            this.selectedCardIndex = this.hoveredCardIndex;
        }
    };

    private handleButtonClick(id: ShopButton['id']) {
        if (id === 'back') {
            uiStateMachine.transitionTo(UIState.LOBBY);
            return;
        }
        if (id === 'equip') {
            if (this.isSelectedCueEquipped()) return;
            const cue = CUES[this.selectedCardIndex];
            this.settingsManager.saveUIColors({
                cueStickColor: cue.stickColor,
                cueTipColor: cue.tipColor
            });
            this.equippedCueId = cue.id;
            notificationService.show(`${cue.name} equipped`, 'success', 2400);
        }
    }

    update(_dt: number): void {}

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.renderBackground(ctx, width, height);
        this.renderHeader(ctx, width);
        this.renderCards(ctx);
        this.renderFooter(ctx);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#020710');
        gradient.addColorStop(0.5, '#071a36');
        gradient.addColorStop(1, '#09030f');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.globalAlpha = 0.15;
        const gridSize = 60;
        for (let y = 0; y < height; y += gridSize) {
            for (let x = 0; x < width; x += gridSize) {
                ctx.strokeStyle = 'rgba(255,255,255,0.04)';
                ctx.strokeRect(x, y, gridSize, gridSize);
            }
        }
        ctx.restore();
    }

    private renderHeader(ctx: CanvasRenderingContext2D, width: number) {
        const title = 'Cue Workshop';
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = '600 46px "Orbitron", Arial, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 12;
        ctx.fillText(title.toUpperCase(), 60, 40);

        ctx.font = '14px "Nunito", Arial, sans-serif';
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Rotate your arsenal and apply neon finishes instantly.', 62, 92);
        ctx.restore();

        drawCurrencyPill(ctx, width - 200, 50, 2500, 'coins');
    }

    private renderCards(ctx: CanvasRenderingContext2D) {
        this.cardRects.forEach((rect, index) => {
            const cue = CUES[index];
            if (!cue) return;
            const isSelected = index === this.selectedCardIndex;
            const isHovered = index === this.hoveredCardIndex;
            this.drawCueCard(ctx, rect, cue, isSelected, isHovered);
        });
    }

    private drawCueCard(ctx: CanvasRenderingContext2D, rect: Rect, cue: CueCard, isSelected: boolean, isHovered: boolean) {
        const borderColor = isSelected ? cue.accent : 'rgba(255,255,255,0.12)';
        ctx.save();

        drawPanel(ctx, rect);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.stroke();

        if (isHovered || isSelected) {
            ctx.save();
            ctx.globalAlpha = isSelected ? 0.18 : 0.1;
            const hoverGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
            hoverGrad.addColorStop(0, cue.accent);
            hoverGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = hoverGrad;
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            ctx.restore();
        }

        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(rect.x + 20, rect.y + 20, rect.width - 40, 110);
        ctx.fillStyle = cue.stickColor;
        ctx.fillRect(rect.x + 30, rect.y + 70, rect.width - 60, 10);
        ctx.fillStyle = cue.tipColor;
        ctx.fillRect(rect.x + 30, rect.y + 68, 8, 14);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 20px "Montserrat", Arial';
        ctx.fillText(cue.name, rect.x + 24, rect.y + 160);

        ctx.font = '12px "Nunito", Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillText(cue.desc, rect.x + 24, rect.y + 185, rect.width - 48);

        ctx.font = '11px "Montserrat", Arial';
        ctx.fillStyle = '#000';
        const rarityWidth = ctx.measureText(cue.rarity).width + 26;
        ctx.fillStyle = this.getRarityColor(cue.rarity);
        ctx.fillRect(rect.x + 24, rect.y + 132, rarityWidth, 22);
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cue.rarity, rect.x + 24 + rarityWidth / 2, rect.y + 143);

        if (cue.id === this.equippedCueId) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(rect.x, rect.y + rect.height - 36, rect.width, 36);
            ctx.fillStyle = '#4CAF50';
            ctx.font = '600 14px "Montserrat", Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('EQUIPPED', rect.x + rect.width / 2, rect.y + rect.height - 18);
        }

        ctx.restore();
    }

    private renderFooter(ctx: CanvasRenderingContext2D) {
        this.buttons.forEach((button) => {
            if (button.id === 'equip') {
                const disabled = this.isSelectedCueEquipped();
                const label = disabled ? 'Equipped' : button.label;
                const color = disabled ? 'rgba(180,180,180,0.35)' : button.color;
                const hovered = this.hoveredButton?.id === button.id && !disabled;
                drawGlossyButton(ctx, button.rect, label, color, hovered);
            } else {
                drawGlossyButton(ctx, button.rect, button.label, button.color, this.hoveredButton?.id === button.id);
            }
        });
    }

    private getRarityColor(rarity: CueCard['rarity']) {
        switch (rarity) {
            case 'COMMON':
                return '#9E9E9E';
            case 'RARE':
                return '#00B4FF';
            case 'EPIC':
                return '#A335EE';
            case 'LEGENDARY':
                return '#FFD700';
            default:
                return '#FFFFFF';
        }
    }

    private syncEquippedCue() {
        const colors = this.settingsManager.getUIColors();
        const index = CUES.findIndex(
            (cue) =>
                cue.stickColor.toLowerCase() === colors.cueStickColor.toLowerCase() &&
                cue.tipColor.toLowerCase() === colors.cueTipColor.toLowerCase()
        );
        if (index >= 0) {
            this.selectedCardIndex = index;
            this.equippedCueId = CUES[index].id;
        } else {
            this.selectedCardIndex = 0;
            this.equippedCueId = CUES[0].id;
        }
    }

    private isSelectedCueEquipped() {
        const cue = CUES[this.selectedCardIndex];
        return cue ? cue.id === this.equippedCueId : false;
    }
}
