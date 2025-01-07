import fs from 'node:fs';
import Discord from 'discord.js';
import { operators, operatorNames } from './rhodes_api.ts';
import { generateSideBySideImage, urlToBuffer, pileDriverGifs } from './image_gen.ts';
import process from 'node:process';

const randomElement = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

const { error } = (await import('dotenv')).config();
if (error) throw error;
// DISCORD_TOKEN env var is checked during construction, not login() method

const client = new Discord.Client({
	intents: ['Guilds', 'GuildMessages', 'MessageContent']
});

const commands: Discord.ApplicationCommandDataResolvable[] = [
	{
		name: 'set_chance',
		description: 'set pile driver chance',
		options: [
			{
				type: Discord.ApplicationCommandOptionType.Number,
				name: 'chance',
				description: 'chance',
				required: true,
				minValue: 0,
				maxValue: 1
			}
		]
	},
	{
		name: 'set_channels',
		description: 'set channels to activate pile driver'
	}
];

client.on('ready', client => {
	console.log(`Logged in as ${client.user.tag}!`);
	client.guilds
		.fetch('1317908398066499614')
		.then(g => g.commands.set(commands))
		.then(() => console.log('Set guild commands'));
});

let pileDriverChance = 0.15;
let enabledChannelIds = [
	'1317908398943244310',
	'1317908475002486914',
	'1317928242975342725',
	'1318018369831567450',
	'1317908398943244311'
];

client.on('interactionCreate', interaction => {
	if (!interaction.inCachedGuild()) return;
	if (interaction.isChatInputCommand()) {
		switch (interaction.commandName) {
			case 'set_chance':
				pileDriverChance = interaction.options.getNumber('chance', true);
				interaction.reply(`set pile driver chance to ${pileDriverChance}`);
				break;
			case 'set_channels':
				interaction.reply({
					content: 'choose channels to enable pile driver in',
					components: [
						{
							type: Discord.ComponentType.ActionRow,
							components: [
								{
									type: Discord.ComponentType.ChannelSelect,
									channelTypes: [Discord.ChannelType.GuildText],
									customId: 'set_channels',
									maxValues: 25
								}
							]
						}
					]
				});
				break;
		}
	} else if (interaction.isChannelSelectMenu()) {
		switch (interaction.customId) {
			case 'set_channels': {
				let channelMentions = '';
				enabledChannelIds = [];
				for (const channelId of interaction.channels.keys()) {
					enabledChannelIds.push(channelId);
					channelMentions += `<#${channelId}> `;
				}
				interaction.reply(`channels updated to: ${channelMentions}`);
				console.log(`channels updated to: ${enabledChannelIds}`);
				break;
			}
		}
	}
});

if (!fs.existsSync('gif_links.json')) {
	fs.writeFileSync('gif_links.json', '{}');
}
const gifLinks: NodeJS.Dict<string> = JSON.parse(fs.readFileSync('gif_links.json').toString());

client.on('messageCreate', async message => {
	const { content, channelId, author } = message;

	if (!enabledChannelIds.includes(channelId) || author.bot) return;

	let operatorNameFound;
	for (const operatorName of operatorNames) {
		if (content.toLowerCase().includes(operatorName)) {
			operatorNameFound = operatorName;
			break;
		}
	}

	if (!operatorNameFound) return;

	// W is a single letter and sent too often, so cut it's chance in half
	// prettier-ignore
	const chance = (operatorNameFound === 'w') ? (Math.random() * 2) : Math.random();

	if (chance >= pileDriverChance) return;

	if (operatorNameFound in gifLinks) {
		console.log(`${operatorNameFound} found in gifLinks, sending link`);
		message.reply(gifLinks[operatorNameFound]!);
		return;
	}

	const filename = `${operatorNameFound}.gif`;

	console.log(`${operatorNameFound}: no gif found, generating one...`);

	const operatorData = operators[operatorNameFound];
	if (!operatorData) throw Error('operators[operatorNameFound] is undefined????');

	const artUrl = operatorData.art[0].link;
	const pileDriverUrl = randomElement(pileDriverGifs);

	const artBuffer = await urlToBuffer(artUrl);
	const pileDriverBuffer = await urlToBuffer(pileDriverUrl);
	const combinedGifBuffer = await generateSideBySideImage(artBuffer, pileDriverBuffer);

	// save attachment url for later uses
	const reply = await message.reply({
		files: [{ contentType: 'image/gif', name: filename, attachment: combinedGifBuffer }]
	});
	const attachment = reply.attachments.first();
	if (!attachment) {
		message.reply('something has gone horribly wrong: cannot get attachment url');
		return;
	}
	gifLinks[operatorNameFound] = attachment.url;
});

const exitHandler = (err?: Error) => {
	if (err)
		client.channels.fetch(randomElement(enabledChannelIds)).then(c => {
			if (!c?.isSendable()) return;
			c.send(`**this is an error, bot is crashing rn**\n\`\`\`js\n${err.stack ?? err}\n\`\`\``);
		});
	fs.writeFileSync('gif_links.json', JSON.stringify(gifLinks, null, '\t'));
	client.destroy();
	process.exit(err ? 1 : 0);
};

process.on('uncaughtException', exitHandler);
process.on('SIGTERM', exitHandler);
process.on('SIGINT', exitHandler);
process.on('beforeExit', exitHandler);

client.login();
