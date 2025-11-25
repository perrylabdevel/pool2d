// Global style prefix shared by all frames
export const GLOBAL_FRAME_PREFIX = `
Modern 2D vector / digital game art, premium mobile 8-ball pool UI,
rounded square (squircle) frame, thick beveled border, smooth gradients,
subtle rim lighting, center fully transparent (alpha) for avatar,
overall background fully transparent (alpha), ultra-clean edges,
no avatar inside, no letters or numbers, no logos, no watermark,
1:1 aspect ratio, 1024×1024 resolution.
`.trim();

// Optional negative prompt if your image tool supports it
export const FRAME_NEGATIVE_PROMPT = `
photo, photorealistic, real camera, noise, grain, text, watermark, logo,
UI panels, backgrounds, checkerboard patterns, 3D render, perspective distortion,
non-square canvas
`.trim();

export type LeagueFrameId =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "emerald"
  | "diamond"
  | "master"
  | "grandmaster"
  | "elite";

export interface LeagueFrameConfig {
  id: LeagueFrameId;
  displayName: string;
  prompt: string;
  negativePrompt?: string;
  size: "1024x1024";
  transparentBackground: true;
}

export const LEAGUE_FRAMES: LeagueFrameConfig[] = [
  {
    id: "bronze",
    displayName: "BRONZE",
    prompt: `
${GLOBAL_FRAME_PREFIX}
Bronze League frame, warm metallic bronze border with slightly worn / brushed texture,
entry-level but solid, subtle tiny scratches and scuffs, soft orange-brown highlights,
inner glow around the transparent center, small 8-ball or single plain pool ball accent
embedded in one corner, understated and humble but clearly league-themed, high-quality
mobile game asset.
    `.trim(),
    negativePrompt: FRAME_NEGATIVE_PROMPT,
    size: "1024x1024",
    transparentBackground: true
  },
  {
    id: "silver",
    displayName: "SILVER",
    prompt: `
${GLOBAL_FRAME_PREFIX}
Silver League frame, sleek metallic silver border with polished brushed metal texture,
cool gray tones, crisp highlights along the bevels, smooth and modern look, faint inner
glow around the transparent center, subtle crossed pool cues or thin cue line motif
integrated into the frame corners, slightly more refined than bronze, high-quality
mobile game asset.
    `.trim(),
    negativePrompt: FRAME_NEGATIVE_PROMPT,
    size: "1024x1024",
    transparentBackground: true
  },
  {
    id: "gold",
    displayName: "GOLD",
    prompt: `
${GLOBAL_FRAME_PREFIX}
Gold League frame, rich metallic gold border, ornate and premium, subtle engraved patterns
or laurel-like motifs along the sides, strong warm golden highlights, soft outer glow,
inner rim glow around the transparent center, small golden 8-ball badge or tiny crown-and-cue
motif integrated at the bottom edge of the frame, high-quality mobile game asset.
    `.trim(),
    negativePrompt: FRAME_NEGATIVE_PROMPT,
    size: "1024x1024",
    transparentBackground: true
  },
  {
    id: "platinum",
    displayName: "PLATINUM",
    prompt: `
${GLOBAL_FRAME_PREFIX}
Platinum League frame, cool metallic platinum border with blue-white sheen, futuristic
segmented panels, sharp precise bevels, subtle cyan accent lines, soft electric glow
along the inner edge, hints of illuminated rail segments inspired by pool table rails,
minimalist but very high-tech look, high-quality mobile game asset.
    `.trim(),
    negativePrompt: FRAME_NEGATIVE_PROMPT,
    size: "1024x1024",
    transparentBackground: true
  },
  {
    id: "emerald",
    displayName: "EMERALD",
    prompt: `
${GLOBAL_FRAME_PREFIX}
Emerald League frame, deep green metallic-gem hybrid border, inspired by pool table felt
and emerald gemstone facets, rich dark greens with brighter emerald highlights, subtle
faceted segments catching light, soft green aura around the outer edge, tiny inlaid gem
chips at the corners, transparent center looking like cut-out over a glowing green rail
motif, high-quality mobile game asset.
    `.trim(),
    negativePrompt: FRAME_NEGATIVE_PROMPT,
    size: "1024x1024",
    transparentBackground: true
  },
  {
    id: "diamond",
    displayName: "DIAMOND",
    prompt: `
${GLOBAL_FRAME_PREFIX}
Diamond League frame, crystalline border made of diamond-like facets, prismatic reflections
with cool blues, cyans and purples, very bright highlights and sharp light breaks, elite
and prestigious feel, strong glowing blue aura around the entire frame, inner rim glowing
softly around the transparent center, tiny inlaid diamond shapes or jewel-like nodes at
the corners, high-quality mobile game asset.
    `.trim(),
    negativePrompt: FRAME_NEGATIVE_PROMPT,
    size: "1024x1024",
    transparentBackground: true
  },
  {
    id: "master",
    displayName: "MASTER",
    prompt: `
${GLOBAL_FRAME_PREFIX}
Master League frame, dark obsidian-like metallic border with gold inlay lines, powerful
and disciplined look, strong bevels with sharp highlights, subtle engraved cue and ball
motifs along the sides, tiny star-like accents at the corners, faint golden aura, inner
edge glow around the transparent center, clearly above Platinum and Diamond in prestige,
high-quality mobile game asset.
    `.trim(),
    negativePrompt: FRAME_NEGATIVE_PROMPT,
    size: "1024x1024",
    transparentBackground: true
  },
  {
    id: "grandmaster",
    displayName: "GRANDMASTER LEAGUE",
    prompt: `
${GLOBAL_FRAME_PREFIX}
Grandmaster League frame, ultra-ornate border combining dark metal and bright gold-platinum
accents, complex layered structure with wing-like or flared elements extending slightly
beyond the rounded square silhouette while keeping the basic squircle shape, multiple small
star or crown motifs embedded tastefully, intense but controlled glow around the outer edge,
inner rim glow around the transparent center, feels legendary and rare, high-quality mobile
game asset.
    `.trim(),
    negativePrompt: FRAME_NEGATIVE_PROMPT,
    size: "1024x1024",
    transparentBackground: true
  },
  {
    id: "elite",
    displayName: "ELITE",
    prompt: `
${GLOBAL_FRAME_PREFIX}
Elite League frame, ultra-clean and minimalist high-end design, near-black metallic base
with subtle iridescent edge highlights (blues, purples, teals), very smooth bevels and
minimal ornamentation, thin luminous accent line running just inside the border, faint
halo around the frame, no gimmicky motifs, pure top-tier competitive vibe, inner edge
glow around the transparent center, high-quality mobile game asset.
    `.trim(),
    negativePrompt: FRAME_NEGATIVE_PROMPT,
    size: "1024x1024",
    transparentBackground: true
  }
];
