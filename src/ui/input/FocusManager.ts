export interface Focusable {
    id: string;
    rect?: { x: number; y: number; width: number; height: number }; // For auto-navigation (future)
    onFocus?: () => void;
    onBlur?: () => void;
    onAction?: () => void;
    // Navigation links (optional - can be inferred or explicit)
    up?: string;
    down?: string;
    left?: string;
    right?: string;
}

export class FocusManager {
    private elements: Map<string, Focusable> = new Map();
    private currentFocusId: string | null = null;
    private enabled: boolean = true;

    constructor() {
        this.handleKeyDown = this.handleKeyDown.bind(this);
        window.addEventListener('keydown', this.handleKeyDown);
    }

    public dispose() {
        window.removeEventListener('keydown', this.handleKeyDown);
        this.elements.clear();
    }

    public setEnabled(enabled: boolean) {
        this.enabled = enabled;
        if (!enabled) {
            this.blur();
        }
    }

    public register(element: Focusable) {
        this.elements.set(element.id, element);
    }

    public unregister(id: string) {
        if (this.currentFocusId === id) {
            this.blur();
        }
        this.elements.delete(id);
    }

    public clear() {
        this.blur();
        this.elements.clear();
    }

    public focus(id: string) {
        if (!this.enabled) return;

        const element = this.elements.get(id);
        if (!element) return;

        if (this.currentFocusId && this.currentFocusId !== id) {
            const current = this.elements.get(this.currentFocusId);
            current?.onBlur?.();
        }

        this.currentFocusId = id;
        element.onFocus?.();
    }

    public blur() {
        if (this.currentFocusId) {
            const current = this.elements.get(this.currentFocusId);
            current?.onBlur?.();
            this.currentFocusId = null;
        }
    }

    public getCurrentFocus(): string | null {
        return this.currentFocusId;
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (!this.enabled || !this.currentFocusId) return;

        const current = this.elements.get(this.currentFocusId);
        if (!current) return;

        let nextId: string | undefined;

        switch (e.key) {
            case 'ArrowUp':
                nextId = current.up;
                break;
            case 'ArrowDown':
                nextId = current.down;
                break;
            case 'ArrowLeft':
                nextId = current.left;
                break;
            case 'ArrowRight':
                nextId = current.right;
                break;
            case 'Enter':
            case ' ': // Space
                current.onAction?.();
                e.preventDefault(); // Prevent scrolling
                return;
        }

        if (nextId) {
            this.focus(nextId);
            e.preventDefault(); // Prevent scrolling
        }
    }
}
