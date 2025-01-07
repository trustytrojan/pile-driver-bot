import { Buffer } from 'node:buffer';
import sharp from 'sharp';
import GIFEncoder from 'gifencoder';
import { stdout } from 'node:process';

// TODO: store several gifs per character. first step: turn this into an object
export const pileDriverGifs = [
	'https://media1.tenor.com/m/Q7KV-nZ8W-AAAAAd/piledriver-sex.gif',
	'https://media1.tenor.com/m/xpoRJWS15pEAAAAd/diesel-hammer-crane.gif',
	'https://media1.tenor.com/m/qNgqVKtbEtMAAAAd/the-undertaker-entrance.gif'
];

export async function generateSideBySideImage(image: string | Buffer, gif: string | Buffer): Promise<Buffer> {
	const gifSharp = sharp(gif);
	const gifMetadata = await gifSharp.metadata();

	if (!gifMetadata.width || !gifMetadata.height || !gifMetadata.pages) {
		throw Error('metadata missing');
	}

	const imgSharp = sharp(image).resize({ height: gifMetadata.height });
	const imgMetadata = await imgSharp.metadata();

	if (!imgMetadata.width || !imgMetadata.height) {
		throw Error('metadata missing');
	}

	// console.log(`image size: ${imgMetadata.width}x${imgMetadata.height}`);

	const aspectRatio = imgMetadata.width / imgMetadata.height;
	const newImgWidth = Math.round(gifMetadata.height * aspectRatio);
	// console.log(`aspectRatio=${aspectRatio} newImgWidth=${newImgWidth}`);

	const width = newImgWidth + gifMetadata.width;
	const height = gifMetadata.height;
	// console.log(`new gif dimensions: ${width}x${height}`);

	const encoder = new GIFEncoder(width, height);
	encoder.start();
	encoder.setRepeat(0);
	encoder.setDelay(gifMetadata.delay || 100); // Set delay based on GIF metadata or default to 100ms
	encoder.setQuality(10);

	for (let i = 0; i < gifMetadata.pages; i++) {
		const gifFrame = await sharp(gif, { page: i }).toBuffer();

		const compositeImage = await sharp({
			create: {
				width,
				height,
				channels: 4,
				background: { r: 255, g: 255, b: 255, alpha: 255 }
			}
		})
			.composite([
				{ input: await imgSharp.toBuffer(), top: 0, left: 0 },
				{ input: gifFrame, top: 0, left: newImgWidth }
			])
			.raw()
			.toBuffer();

		encoder.addFrame(compositeImage);
		stdout.write(`\r\x1b[2K${i + 1}/${gifMetadata.pages}`);
	}

	console.log();
	encoder.finish();
	return encoder.out.getData();
}

export const urlToBuffer = (url: string) =>
	fetch(url)
		.then(r => r.arrayBuffer())
		.then(Buffer.from);
