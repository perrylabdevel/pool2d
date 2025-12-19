# HDPI Asset Sizing Guide

Designing for hi-density (“retina”) displays keeps RailRush’s neon look crisp on everything from mid-tier Android tablets to ProMotion iPhones. This guide defines how to size UI images, table skins, and other raster assets so they stay sharp without bloating downloads.

## 1. Key Concepts

| Term | Meaning |
| --- | --- |
| **Logical pixels** | CSS pixels or in-game units the layout code uses (e.g., HUD chip = 28 px). |
| **Physical pixels** | Actual pixels baked into your exported PNG/WebP. HiDPI screens pack more physical pixels into the same logical space. |
| **Device Pixel Ratio (DPR)** | `window.devicePixelRatio`. 1.0 = standard, 2.0 = Retina, 3.0 = high-end phones. |

RailRush often renders logical elements at a higher physical resolution, then scales them down cosmetically. Example: HUD ball chips compute `baseSizePx * dpr * 1.5` (capped at 256 px) before generating icons to stay lossless on retina gear @src/game/Game.ts#1925-1936.

## 2. Recommended Workflow

1. **Define the logical size first.** Match the size referenced in layout code or design tokens.
2. **Export raster assets at ≥2× the logical dimension** (ideally 3× when detail warrants). This guarantees enough pixels for DPR 2–3 devices without artifacts.
3. **Keep aspect ratios consistent and aligned to 2 px increments** so Nine-Patch/stretching behaves predictably.
4. **Use vector masters when possible.** Export multiple resolutions (1×, 2×, 3×) from a single source to avoid rounding glitches.
5. **Group exports by category** so AssetLoader caching and preload bundles stay tidy (`/public/assets/images/...`).

## 3. Category-Specific Targets

| Asset Type | Logical Size (CSS px) | Export Size(s) | Notes |
| --- | --- | --- | --- |
| HUD ball chips | 28 px diameter | 84 px (3×) preferred; minimum 56 px (2×) | Game multiplies by DPR and 1.5 for breathing room, so provide up to 126 px source when detail matters. |
| Pocket FX icons / badges | 32–40 px logical | 96–120 px | Maintain even padding; translucent glows should extend beyond crop by ~10 %. |
| Modal & nav icons | 48 px logical | 96 px (2×) and 144 px (3×) | Export as PNG for sharp edges or WebP for gradients. |
| Lobby & shop cards | 320×180 px logical | 640×360 px (2×) | Use separate foreground/background layers so parallax shaders can reuse them. |
| Ball & cue skins | 1:1 UV textures | 1024² primary, 2048² for hero skins | Keep detail in power-of-two sizes for WebGL mipmaps. |
| Table/felt overlays | 1024×2048 logical | 2048×4096 export | Reserve 4–6 px bleed outside the safe play area for camera pans. |
| Background illustrations | 1440×810 logical | 2880×1620 (2×) or 4320×2430 (3×) | Prefer WebP with quality 85–90 to stay <1 MB. |

> **Tip:** When in doubt, favor 3× exports for UI glyphs and 2× for large illustrations. You can downscale on build, but upscaling after shipping always blurs.

## 4. File Size & Format Guardrails

- PNG for assets needing alpha + razor-sharp edges (icons, HUD chips).
- WebP for gradients, photos, and large panels (cards, scenes).
- Target <300 KB per HUD element and <1 MB per large illustration to keep mobile bundles slim.
- Keep filenames kebab-cased and match the getters in `AssetRegistry` so TypeScript references stay typed.

## 5. Verification Checklist

1. **Pixel density sanity check:** zoom to 200 % in Figma/PS—edges should still look crisp.
2. **Preview at 1× and 3× scales** to ensure line weights remain readable when downscaled.
3. **Automated audit:** run `python check_hidpi.py` to list every asset’s dimensions and flag low-res files @check_hidpi.py#1-45.
4. **In-game QA:** load the asset via AssetLoader/AssetRegistry and inspect on a Retina simulator + a baseline 1× display. Look for aliasing, halos, or shading mismatch.

## 6. Delivery Notes

- Place final exports under `public/assets/images/<category>/`.
- Update `AssetRegistry` immediately so new files are available to scenes/components.
- If you add a new size-dependent feature, document its logical dimensions in this file to keep the table above authoritative.

Following this playbook keeps RailRush’s vibrant arcade aesthetic intact across HDPI displays without wasting GPU memory or bandwidth.
