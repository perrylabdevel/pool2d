const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/assets/tmp/skin.png');

try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(24);
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);

    // PNG Signature
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        console.log('Error: Not a PNG file');
        process.exit(1);
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    console.log(`DIMENSIONS: ${width}x${height}`);
} catch (err) {
    console.error('Error:', err.message);
}
