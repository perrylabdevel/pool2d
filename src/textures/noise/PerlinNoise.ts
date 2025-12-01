export class PerlinNoise {
    private static permutation: number[] = [];
    private static initialized = false;

    static initialize(seed: number = 0): void {
        // Generate permutation table (for repeatability)
        const p = [];
        for (let i = 0; i < 256; i++) p[i] = i;

        // Shuffle based on seed
        const random = this.seededRandom(seed);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }

        // Duplicate to avoid overflow
        this.permutation = [...p, ...p];
        this.initialized = true;
    }

    static noise2D(x: number, y: number): number {
        if (!this.initialized) this.initialize();

        // Find unit grid cell
        const xi = Math.floor(x) & 255;
        const yi = Math.floor(y) & 255;

        // Relative position within cell
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);

        // Fade curves (6t^5 - 15t^4 + 10t^3)
        const u = this.fade(xf);
        const v = this.fade(yf);

        // Hash coordinates of 4 corners
        const aa = this.permutation[this.permutation[xi] + yi];
        const ab = this.permutation[this.permutation[xi] + yi + 1];
        const ba = this.permutation[this.permutation[xi + 1] + yi];
        const bb = this.permutation[this.permutation[xi + 1] + yi + 1];

        // Blend results from 4 corners
        const x1 = this.lerp(
            this.grad2D(aa, xf, yf),
            this.grad2D(ba, xf - 1, yf),
            u
        );
        const x2 = this.lerp(
            this.grad2D(ab, xf, yf - 1),
            this.grad2D(bb, xf - 1, yf - 1),
            u
        );

        return this.lerp(x1, x2, v);
    }

    static octaveNoise2D(
        x: number,
        y: number,
        octaves: number = 4,
        persistence: number = 0.5
    ): number {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;

            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return total / maxValue; // Normalize to [-1, 1]
    }

    private static fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private static lerp(a: number, b: number, t: number): number {
        return a + t * (b - a);
    }

    private static grad2D(hash: number, x: number, y: number): number {
        // Convert low 2 bits of hash into gradient vector
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
    }

    private static seededRandom(seed: number): () => number {
        let s = seed;
        return () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    }
}
