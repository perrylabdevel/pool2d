const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/assets/tmp/skin.png');
const outPath = path.join(process.cwd(), 'skin_dims.txt');

try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(24);
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);

    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        fs.writeFileSync(outPath, 'Error: Not a PNG file');
        process.exit(1);
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    fs.writeFileSync(outPath, `${width}x${height}`);
} catch (err) {
    fs.writeFileSync(outPath, 'Error: ' + err.message);
}
