// Generate PNG icons from static/favicon.svg.
// Sizes: 192 (any), 512 (any), 512 (maskable with safe-area padding).

import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = readFileSync('static/favicon.svg');

async function gen(size, outName) {
	const buf = await sharp(svg).resize(size, size).png().toBuffer();
	writeFileSync(`static/${outName}`, buf);
	console.log(`  ✓ static/${outName} (${size}×${size})`);
}

// Maskable: render the SVG into a 410×410 area centered on a 512×512 canvas
// (keeps content within the safe ~80% zone PWA convention requires).
async function genMaskable() {
	const inner = 410;
	const innerBuf = await sharp(svg).resize(inner, inner).png().toBuffer();
	const out = await sharp({
		create: {
			width: 512,
			height: 512,
			channels: 4,
			background: { r: 21, g: 17, b: 13, alpha: 1 } // matches favicon bg
		}
	})
		.composite([{ input: innerBuf, top: 51, left: 51 }])
		.png()
		.toBuffer();
	writeFileSync('static/icon-maskable-512.png', out);
	console.log(`  ✓ static/icon-maskable-512.png (512×512, maskable)`);
}

await gen(192, 'icon-192.png');
await gen(512, 'icon-512.png');
await gen(180, 'apple-touch-icon.png');
await genMaskable();
console.log('Done.');
