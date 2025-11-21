import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceImage = path.join(__dirname, '../src/assets/img/look.jpeg');
const outputDir = path.join(__dirname, '../src/assets/img/lobby-cards');

// Card definitions from LobbyScene with their sprite coordinates
const cards = {
  // Landscape cards (365x200px)
  'play-ranked': { sx: 60, sy: 40, sw: 900, sh: 500, width: 365, height: 200 },
  'practice': { sx: 1900, sy: 40, sw: 760, sh: 520, width: 365, height: 200 },
  'shop': { sx: 60, sy: 580, sw: 830, sh: 480, width: 365, height: 200 },

  // Portrait cards (365x400px)
  'profile': { sx: 950, sy: 540, sw: 840, sh: 660, width: 365, height: 400 },
  'arcade': { sx: 1890, sy: 640, sw: 760, sh: 520, width: 365, height: 400 },
  'mini-games': { sx: 1890, sy: 1120, sw: 760, sh: 360, width: 365, height: 400 }
};

async function sliceCards() {
  const fs = await import('fs');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Slicing lobby cards from look.jpeg...\n');

  for (const [name, coords] of Object.entries(cards)) {
    const outputPath = path.join(outputDir, `${name}.png`);

    try {
      await sharp(sourceImage)
        .extract({
          left: coords.sx,
          top: coords.sy,
          width: coords.sw,
          height: coords.sh
        })
        .resize(coords.width, coords.height, {
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 90 })
        .toFile(outputPath);

      console.log(`✓ Created ${name}.png (${coords.width}x${coords.height})`);
    } catch (error) {
      console.error(`✗ Failed to create ${name}.png:`, error.message);
    }
  }

  console.log('\nAll cards sliced successfully!');
}

sliceCards().catch(console.error);
