import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import { stdout } from 'node:process';

import sharp from 'sharp';
import GIFEncoder from 'gifencoder';
import Discord from 'discord.js';

const pileDriverGifs = [
	'https://media1.tenor.com/m/Q7KV-nZ8W-AAAAAd/piledriver-sex.gif',
	'https://media1.tenor.com/m/xpoRJWS15pEAAAAd/diesel-hammer-crane.gif'
];

const randomElement = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

async function generateSideBySideImage(image: string | Buffer, gif: string | Buffer): Promise<Buffer> {
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

	const aspectRatio = imgMetadata.width / imgMetadata.height;
	const newImgWidth = gifMetadata.height * aspectRatio;

	const width = newImgWidth + gifMetadata.width;
	const height = gifMetadata.height;

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
		stdout.write(`\r${i + 1}/${gifMetadata.pages}`);
	}

	encoder.finish();
	return encoder.out.getData();
}

const urlToBuffer = (url: string) =>
	fetch(url)
		.then(r => r.arrayBuffer())
		.then(Buffer.from);

type RhodesAPIOperator = {
	name: string;
	art: {
		name: string;
		link: string;
	}[];
	// other stuff not here...
};

let operators: NodeJS.Dict<RhodesAPIOperator> = {};
if (!fs.existsSync('operators.json')) {
	const operatorsData: RhodesAPIOperator[] = await fetch('https://api.rhodesapi.com/api/operator').then(r => r.json());
	for (const operatorData of operatorsData) {
		operators[operatorData.name.toLowerCase()] = operatorData;
	}
	fs.writeFileSync('operators.json', JSON.stringify(operators, null, '\t'));
} else {
	// operators = await import('./operators.json', { with: { type: 'json' } });
	operators = JSON.parse(fs.readFileSync('operators.json').toString());
}

const operatorNames = Object.keys(operators);

const client = new Discord.Client({
	intents: [
		'Guilds',
		'GuildMessages',
		'MessageContent'
	]
});

client.on('ready', () => {
	console.log('ready');
});

client.on('messageCreate', async message => {
	const { content } = message;

	let operatorNameFound;
	for (const operatorName of operatorNames) {
		if (content.includes(operatorName)) {
			operatorNameFound = operatorName;
			break;
		}
	}

	if (!operatorNameFound) {
		return;
	}

	const filename = `${operatorNameFound}.gif`;

	if (fs.existsSync(filename)) {
		message.reply({ files: [fs.readFileSync(filename)] });
		return;
	}

	const operatorData = operators[operatorNameFound];
	if (!operatorData)
		throw Error('????');

	const artUrl = operatorData.art[0].link;
	const pileDriverUrl = randomElement(pileDriverGifs);

	const artBuffer = await urlToBuffer(artUrl);
	const pileDriverBuffer = await urlToBuffer(pileDriverUrl);
	const combinedGifBuffer = await generateSideBySideImage(artBuffer, pileDriverBuffer);
	fs.writeFileSync(filename, combinedGifBuffer);
	message.reply({ files: [{ contentType: 'image/gif', name: filename, attachment: combinedGifBuffer }] });
});

client.login(fs.readFileSync('token').toString());
