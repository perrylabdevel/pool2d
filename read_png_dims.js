const fs = require('fs');
const path = 'src/assets/tmp/skin.png';

try {
    const fd = fs.openSync(path, 'r');
    const buffer = Buffer.alloc(24);
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);

    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        console.error('Not a PNG file');
        process.exit(1);
    }

    // Width at offset 16, Height at offset 20 (Big Endian)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    console.log(JSON.stringify({ width, height }));
} catch (e) {
    console.error('Error reading file:', e);
}
