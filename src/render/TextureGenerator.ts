import * as THREE from 'three';

export class TextureGenerator {
    private static createOffscreenCanvas(width: number, height: number): { canvas: HTMLCanvasElement | OffscreenCanvas, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
        if (typeof OffscreenCanvas !== 'undefined') {
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
            if (!ctx) throw new Error('Failed to get OffscreenCanvas context');
            return { canvas, ctx };
        } else {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
            if (!ctx) throw new Error('Failed to get Canvas context');
            return { canvas, ctx };
        }
    }

    static generateFeltTexture(
        width: number = 512,
        height: number = 512,
        baseColorHex: string | number,
        options: {
            noiseScale?: number;
            noiseIntensity?: number;
            weaveScale?: number;
            weaveIntensity?: number;
            colorVariation?: number;
        } = {}
    ): THREE.CanvasTexture {
        const { canvas, ctx } = this.createOffscreenCanvas(width, height);

        const noiseScale = options.noiseScale ?? 15;
        const noiseIntensity = options.noiseIntensity ?? 15;
        const weaveScale = options.weaveScale ?? 2;
        const weaveIntensity = options.weaveIntensity ?? 0.03;
        const colorVariation = options.colorVariation ?? 0;
        console.log('Generating felt with options:', { noiseScale, noiseIntensity, weaveScale, weaveIntensity, colorVariation });

        // Fill base color
        const color = new THREE.Color(baseColorHex);

        // Apply color variation if requested
        if (colorVariation > 0) {
            const hsl = { h: 0, s: 0, l: 0 };
            color.getHSL(hsl);
            hsl.l += (Math.random() - 0.5) * colorVariation * 0.1;
            color.setHSL(hsl.h, hsl.s, hsl.l);
        }

        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(0, 0, width, height);

        // Add noise for nap/fuzzy texture
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            // Subtle monochromatic noise
            const noise = (Math.random() - 0.5) * noiseIntensity;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imageData, 0, 0);

        // Add weave pattern (cross-hatch)
        if (weaveIntensity > 0) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = `rgba(255, 255, 255, ${weaveIntensity})`;

            // Horizontal lines
            for (let y = 0; y < height; y += weaveScale) {
                ctx.fillRect(0, y, width, 1);
            }
            // Vertical lines
            for (let x = 0; x < width; x += weaveScale) {
                ctx.fillRect(x, 0, 1, height);
            }
        }

        const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        // Anisotropy helps with oblique viewing angles, though we are top-down mostly
        texture.anisotropy = 4;
        return texture;
    }

    static generateWoodTexture(
        width: number = 512,
        height: number = 512,
        baseColorHex: string | number,
        options: {
            grainScaleX?: number;
            grainScaleY?: number;
            grainIntensity?: number;
            turbulence?: number;
            baseColorMix?: number;
        } = {}
    ): THREE.CanvasTexture {
        const { canvas, ctx } = this.createOffscreenCanvas(width, height);

        const grainScaleX = options.grainScaleX ?? 1;
        const grainScaleY = options.grainScaleY ?? 10;
        const grainIntensity = options.grainIntensity ?? 40;
        const turbulence = options.turbulence ?? 0.02;

        const color = new THREE.Color(baseColorHex);
        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(0, 0, width, height);

        // Simple wood grain simulation using noise stretched horizontally
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Perlin-ish noise (simplified for speed/portability without external lib)
        // We'll create a 1D noise array and stretch it
        const noiseArr = new Float32Array(width);
        for (let i = 0; i < width; i++) {
            noiseArr[i] = Math.random();
        }

        // Smooth the noise
        const smoothNoise = new Float32Array(width);
        for (let i = 0; i < width; i++) {
            let sum = 0;
            let count = 0;
            for (let j = -4; j <= 4; j++) {
                const idx = (i + j + width) % width;
                sum += noiseArr[idx];
                count++;
            }
            smoothNoise[i] = sum / count;
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                // Grain pattern: function of y + turbulence from x
                // Stretch along X axis (grain runs horizontal)
                const grainY = (y * grainScaleX + Math.sin(x * turbulence) * grainScaleY) % width;
                const noiseVal = smoothNoise[(Math.floor(grainY) % width + width) % width];

                // Apply grain as darkening streaks
                const grainFactor = (noiseVal - 0.5) * grainIntensity; // Intensity

                data[idx] = Math.max(0, Math.min(255, data[idx] + grainFactor));
                data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + grainFactor));
                data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + grainFactor));
            }
        }
        ctx.putImageData(imageData, 0, 0);

        const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    static generateMetalTexture(
        width: number = 512,
        height: number = 512,
        baseColorHex: string | number,
        options: {
            grainIntensity?: number;
        } = {}
    ): THREE.CanvasTexture {
        const { canvas, ctx } = this.createOffscreenCanvas(width, height);
        const grainIntensity = options.grainIntensity ?? 20;

        const color = new THREE.Color(baseColorHex);
        // Metal usually looks better slightly desaturated or brighter
        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        // Boost lightness slightly for metal
        color.setHSL(hsl.h, hsl.s * 0.8, Math.min(1, hsl.l * 1.1));

        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Brushed metal: heavy horizontal noise
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * grainIntensity;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }

        // Apply a motion blur effect horizontally to simulate brushing
        // This is expensive in JS, so we'll do a simplified version:
        // Just stretch random noise horizontally.
        // Actually, let's reuse the wood grain logic but with 0 turbulence and high X stretch

        ctx.putImageData(imageData, 0, 0);

        // Overlay horizontal streaks
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = `rgba(255,255,255,0.05)`;
        for (let y = 0; y < height; y += 2) {
            if (Math.random() > 0.5) ctx.fillRect(0, y, width, 1);
        }

        const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = 4;
        return texture;
    }

    static generateMatteTexture(
        width: number = 512,
        height: number = 512,
        baseColorHex: string | number,
        options: {
            noiseIntensity?: number;
        } = {}
    ): THREE.CanvasTexture {
        const { canvas, ctx } = this.createOffscreenCanvas(width, height);
        const noiseIntensity = options.noiseIntensity ?? 10;

        const color = new THREE.Color(baseColorHex);
        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Simple uniform noise
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * noiseIntensity;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imageData, 0, 0);

        const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }
}
