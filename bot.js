process.on('message', (msg) => {
	if (!msg.type) return false;

	if (msg.type === 'activity') {
		console.info(msg);
		client.user?.setPresence(msg.data);
	}
});

const os = require('os');
const Discord = require('discord.js');
const {
	REST
} = require('@discordjs/rest');
const {
	Routes
} = require('discord-api-types/v10');

const axios = require('axios').default;
const fs = require('fs/promises');
const WebSocket = require('ws');
const config = require('./config.json');
const path = require('path');

// Useful Regex
const urlRegex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g;
const DiscordInviteLinkRegex = /(?:^|\b)discord(?:(?:app)?\.com\/invite|\.gg(?:\/invite)?)\/(?<code>[\w-]{2,255})(?:$|\b)/gi;

// Variables used throughout code
/**
 * @type {string[]}
 */
let serverdb = [];
/**
 * @type {{match: boolean; reason: string; serverID: string;}[]}
 */
let scamdb = [];
/**
 * @type {Date | null}
 */
let lastUpdate = null;
/**
 * @type {{messageID: string;userID: string;guildID: string}[]}
 */
let lastIdPerGuild = [];

const revision = require('child_process')
	.execSync('git rev-parse HEAD')
	.toString()
	.trim()
	.slice(0, 6);
const startup = new Date();

const urlDBPath = path.join(__dirname, '.', 'db.json');
const serverDBPath = path.join(__dirname, '.', 'server_db.json');

const client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds,
		Discord.GatewayIntentBits.GuildMessages,
		Discord.GatewayIntentBits.GuildMembers,
		Discord.GatewayIntentBits.GuildBans,
		Discord.GatewayIntentBits.MessageContent
	],
	partials: [Discord.Partials.Message, Discord.Partials.Channel],
});
const reportHook = new Discord.WebhookClient({ url: config.discord.reportHook })
const Jimp = require('jimp');
const jsQR = require('jsqr').default;

setInterval(() => {
	updateDb();
}, 1000 * 30 * 60);

const sock = new WebSocket(config.scams.scamSocket, {
	headers: {
		'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158',
		'X-Identity': 'ScamBaiter/1.0; Chris Chrome#9158',
	},
});

sock.onopen = () => {
	console.log('Connected to WS');
};

sock.onmessage = (/** @type {{ data: WebSocket.Data; }} */ message) => {
	if (typeof message.data !== 'string') return;
	/**
	 * @type {{ domains: string[]; type: string; }}
	 */
	const data = JSON.parse(message.data);
	if (data.type === 'add') {
		// Get all the entries in 'data.domains' array and push to db
		scamdb.push(...data.domains);
	} else if (data.type === 'delete') {
		// Get all the entries in 'data.domains' array and remove from db
		scamdb = scamdb.filter(item => !data.domains.includes(item));
	}
};

client.once('ready', async () => {
	console.info(`Logged in as ${client.user?.tag}`);
	await updateDb();

	/**
	 * @type {Discord.RESTPostAPIApplicationCommandsJSONBody[]}
	 */
	const commands = [];
	const everySlashiesData = [
		new Discord.SlashCommandBuilder()
			.setName('botinfo')
			.setDescription('Shows information about the bot.'),
		new Discord.SlashCommandBuilder()
			.setName('check')
			.setDescription('Checks a provided scam URL against the database.')
			.addStringOption((option) =>
				option.setName('text_to_check').setDescription('The domain to check.').setRequired(true)
			),
		new Discord.SlashCommandBuilder()
			.setName('invite')
			.setDescription('Gives the bot invite link.'),
		new Discord.SlashCommandBuilder()
			.setName('update_db')
			.setDescription('Updates database')
	];
	everySlashiesData.forEach((slashies) => {
		commands.push(slashies.toJSON());
	});
	const rest = new REST().setToken(config.discord.token);
	rest.put(Routes.applicationCommands(config.discord.client_id), {
		body: commands
	})
		.then(() => console.log('Successfully registered application commands.'))
		.catch(console.error);
});

client.on('interactionCreate', async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	switch (interaction.commandName) {
		case 'botinfo': {
			if (lastUpdate === null) return;
			const guildCacheSizes = await client.shard?.fetchClientValues('guilds.cache.size');
			if (guildCacheSizes === undefined) throw new Error('Failed to fetch guild cache sizes');
			const hostname = config.owners.includes(interaction.user.id) === true ? os.hostname() : os.hostname().replace(/./g, '•');

			const systemInformationButReadable = `
					Hostname: ${hostname}
					CPU: ${os.cpus()[0].model}
					Total RAM: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
					Free RAM: ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB
					Uptime: <t:${Math.floor(
				Date.now() / 1000 - os.uptime()
			)}:R>
					`;

			const botInfoButReadable = `
					Bot Name: '${client.user?.tag}'
					Guild Count: ${guildCacheSizes.reduce((a, b) => a + b, 0)}
					Shard Count: ${client.shard?.count}
					Shard Latency: ${Math.round(client.ws.ping)}ms
					Startup Time: <t:${Math.floor(
				startup.getTime() / 1000
			)}:D> <t:${Math.floor(
				startup.getTime() / 1000
			)}:T>
					Current Link DB size: ${scamdb.length.toString()}
					Current Server DB size ${serverdb.length.toString()}
					Last Database Update: <t:${Math.floor(
				lastUpdate.getTime() / 1000
			)}:R>
					`;

			const embed = new Discord.EmbedBuilder()
				.setTitle('Bot Information')
				.setTimestamp(new Date())
				.setFields([{
					'name': 'System Information',
					'value': systemInformationButReadable
				},
				{
					'name': 'Bot Info',
					'value': botInfoButReadable
				}
				])
				.setFooter({
					text: `Commit: ${revision}`
				});

			await interaction.reply({
				embeds: [embed]
			});
			return;
		}
		case 'update_db': {
			if (!config.owners.includes(interaction.user.id)) return;
			await interaction.reply('Updating...').then(() => {
				updateDb()
					.then(() => interaction.editReply('Updated Database'))
					.catch(() => interaction.editReply('Failed to Update Database'));
			});
			return;
		}
		case 'invite': {
			await interaction.reply(config.inviteMsg);
			return;
		}
		case 'check': {
			const textToCheck = interaction.options.getString('text_to_check', true);

			const urlRegexResults = urlRegex.exec(textToCheck);
			if (urlRegexResults === null) {
				await interaction.reply('No URLs found to check');
				return;
			}


			/**
			 * @type {string[]}
			 */
			const scamURLsFound = [];
			urlRegexResults.forEach((result) => {
				const removeEndingSlash = result.split('/')[2];
					if (removeEndingSlash === undefined) return interaction.reply('Please provide a valid URL');
					const splited = removeEndingSlash.split('.');
					const domain =
						splited[splited.length - 2] + '.' + splited[splited.length - 1];
				if (scamdb.includes(domain)) scamURLsFound.push(domain);
			});
			if (scamURLsFound.length === 0) await interaction.reply(`\`\`\`${textToCheck}\`\`\` \n Contains no scams`);
			else if (scamURLsFound.length === 1) await interaction.reply(`${scamURLsFound[0]} is a scam`)
			else await interaction.reply(`The following domains are scams: ${scamURLsFound.join(', ')}`);
			return;	
		}
	}
});

const prefix = '$';

client.on('messageCreate', async (message) => {
	if (message.author.bot) return;
	const args = message.content.slice(prefix.length).trim().split(/ +/g);
	const cmd = args.shift()?.toLowerCase();

	const invites = DiscordInviteLinkRegex.exec(message.content);
	if (invites !== null && invites.groups !== undefined) {
		const inviteCode = invites.groups.code;
		const serverID = await client.fetchInvite(inviteCode).then((invite) => invite.guild?.id);

		scamdb.forEach(async (invite) => {
			if (serverID !== invite.serverID) return;
			if (message.deletable) await message.delete();

			const embed = new Discord.EmbedBuilder()
				.setAuthor({
					name: message.guild?.name ?? '',
					iconURL: message.guild?.iconURL() ?? ''
				})
				.setThumbnail(message.author.avatarURL())
				.setFooter({
					text: `${message.id}${message.member?.bannable &&
						!message.member.permissions.has('KickMembers')
						? ' | Softbanned'
						: ' | Not Softbanned'
						}`
				})
				.setFields([{
					name: 'User',
					value: `${message.author} (${message.author.tag})\nID: ${message.author.id}`,
				},
				{
					name: 'Message',
					value: message.content,
				},
				{
					name: 'Invite',
					value: invites[0],
				}])
				.setTimestamp(new Date());

			await reportHook.send({ embeds: [embed] });

			if (
				message.member?.bannable &&
				!message.member.permissions.has('KickMembers')
			) {
				await message.author.send(
					config.discord.banMsg.replace('{guild}', message.guild?.name ?? '')
				);
				await message.member.ban({
					reason: 'Scam detected',
					deleteMessageDays: 1
				});
				await message.guild?.bans.remove(message.author.id, 'AntiScam - Softban');
				return;
			}
		});
	}

	const scamUrls = urlRegex.exec(message.content);
	let isScam = false;
	let scamDomain = '';

	if (scamUrls !== null && cmd !== 'check') {
		for (const potscamurl of scamUrls) {
			// Somtimes potscamurl would be undefined causing a crash
			if (potscamurl === undefined) break;
			// remove everything after the third slash
			const removeEndingSlash = potscamurl.split('/')[2];
			if (removeEndingSlash === undefined) continue;
			const splited = removeEndingSlash.split('.');
			const domain =
				splited[splited.length - 2] + '.' + splited[splited.length - 1];

			// check if domain is in db
			if (scamdb.includes(domain) || scamdb.includes(removeEndingSlash)) {
				isScam = true;
				scamDomain = domain;
				break;
			}
		}
	}
	if (isScam) {
		if (message.deletable) await message.delete();

		// Check if any of the elements in lastIdPerGuild matches the message id and guild id
		if (
			lastIdPerGuild.find(
				(data) =>
					data.userID === message.member?.id && data.guildID === message.guild?.id
			)
		) {
			// Remove the element from the array
			lastIdPerGuild = lastIdPerGuild.filter((data) => data.messageID !== message.id);
			return;
		} else {
			// If the message is not in the array, add it
			lastIdPerGuild.push({
				messageID: message.id,
				userID: message.author.id,
				guildID: message.guild?.id ?? '',
			});
		}

		const embed = new Discord.EmbedBuilder()
			.setTimestamp(new Date())
			.setAuthor({
				name: message.guild?.name ?? '',
				iconURL: message.guild?.iconURL() ?? ''
			})
			.setThumbnail(message.author.avatarURL())
			.setFooter({
				text: `${message.id}${message.member?.bannable &&
					!message.member.permissions.has('KickMembers')
					? ' | Softbanned'
					: ' | Not Softbanned'
					}`
			})
			.setFields([{
				name: 'User',
				value: `${message.author} (${message.author.tag})\nID: ${message.author.id}`,
			},
			{
				name: 'Message',
				value: message.content,
			},
			{
				name: 'URL',
				value: scamDomain,
			}]);


		await reportHook.send({
			embeds: [embed]
		});

		if (
			message.member?.bannable &&
			!message.member.permissions.has('KickMembers')
		) {
			await message.author.send(
				config.discord.banMsg.replace('{guild}', message.guild?.name ?? '')
			);
			await message.member.ban({
				reason: 'Scam detected',
				deleteMessageDays: 1
			});
			await message.guild?.bans.remove(message.author.id, 'AntiScam - Softban');
			return;
		}
	}

	message.attachments.forEach(async (attachment) => {
		if (!attachment.contentType?.startsWith('image')) return;
		const image = await Jimp.read(attachment.url);
		const code = jsQR(image.bitmap.data, image.bitmap.width, image.bitmap.height);
		if (code === null) return;
		if (code.data.startsWith('https://discord.com/ra/') || code.data.startsWith('https://discordapp.com/ra/')) {
			message.reply({
				'embeds': [{
					'description': ':warning: POSSIBLE SCAM DETECTED :warning:\n\nThe image above contains a Discord Login QR code.\nScanning this code with the Discord app will give whoever made the code FULL ACCESS to your account',
				}]
			}).catch((err) => {
				if (err && message.deletable) message.delete();
			});
		}
	});

	// Anything past here is command code
	if (!message.content.toLowerCase().startsWith(prefix)) return;

	switch (cmd) {
		case 'botinfo': {
			if (lastUpdate === null) return;
			const guildCacheSizes = await client.shard?.fetchClientValues('guilds.cache.size');
			if (guildCacheSizes === undefined) throw new Error('Failed to fetch guild cache sizes');
			const hostname = config.owners.includes(message.author.id) === true ? os.hostname() : os.hostname().replace(/./g, '•');

			const systemInformationButReadable = `
			Hostname: ${hostname}
			CPU: ${os.cpus()[0].model}
			Total RAM: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
			Free RAM: ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB
			Uptime: <t:${Math.floor(
				Date.now() / 1000 - os.uptime()
			)}:R>
			`;

			const botInfoButReadable = `
			Bot Name: '${client.user?.tag}'
			Guild Count: ${guildCacheSizes.reduce((a, b) => a + b, 0)}
			Shard Count: ${client.shard?.count}
			Shard Latency: ${Math.round(client.ws.ping)}ms
			Startup Time: <t:${Math.floor(
				startup.getTime() / 1000
			)}:D> <t:${Math.floor(
				startup.getTime() / 1000
			)}:T>
			Current Link DB size: ${scamdb.length.toString()}
			Current Server DB size ${serverdb.length.toString()}
			Last Database Update: <t:${Math.floor(
				lastUpdate.getTime() / 1000
			)}:R>
			`;

			const embed = new Discord.EmbedBuilder()
				.setTitle('Bot Information')
				.setTimestamp(new Date())
				.setFields([{
					'name': 'System Information',
					'value': systemInformationButReadable
				},
				{
					'name': 'Bot Info',
					'value': botInfoButReadable
				}
				])
				.setFooter({
					text: `Commit: ${revision}`
				});

			await message.reply({
				embeds: [embed]
			});
			return;
		}
		case 'update': {
			if (!config.owners.includes(message.author.id)) return;
			const tempMSG = await message.reply('Updating...')
			updateDb()
				.then(() => tempMSG.edit('Updated Database'))
				.catch(() => tempMSG.edit('Failed to Update Database'));
			return;
		}
		case 'invite': {
			await message.reply(config.inviteMsg);
			return;
		}
		case 'check': {
			const textToCheck = args.join(' ');
			if (!textToCheck) {
				await message.reply(
					`Please provide a domain name to check, not the full URL please\nExample: \`${prefix}check discordapp.com\``
				);
				return;
			}

			const urlRegexResults = urlRegex.exec(textToCheck);
			if (urlRegexResults === null) {
				await message.reply('No URLs found to check');
				return;
			}


			/**
			 * @type {string[]}
			 */
			const scamURLsFound = [];
			urlRegexResults.forEach((result) => {
				const removeEndingSlash = result.split('/')[2];
					if (removeEndingSlash === undefined) return message.reply('Please provide a valid URL');
					const splited = removeEndingSlash.split('.');
					const domain =
						splited[splited.length - 2] + '.' + splited[splited.length - 1];
				if (scamdb.includes(domain)) scamURLsFound.push(domain);
			});
			if (scamURLsFound.length === 0) await message.reply(`\`\`\`${textToCheck}\`\`\` \n Contains no scams`);
			else if (scamURLsFound.length === 1) await message.reply(`${scamURLsFound[0]} is a scam`)
			else await message.reply(`The following domains are scams: ${scamURLsFound.join(', ')}`);			
		}
	}
});

client.login(config.discord.token).catch((err) => console.error(err));

const updateDb = async () => {
	// Code for updating SCAMDB
	try {
		let scamAPIRESP = await axios.get(config.scams.scamApi, {
			headers: {
				'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158',
				// Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
			},
		});

		await fs.writeFile(urlDBPath, JSON.stringify(scamAPIRESP.data));
		scamdb = scamAPIRESP.data;
		lastUpdate = new Date();
		console.info('Updated scam DB!');
	} catch (e) {
		scamdb = require(urlDBPath);
		console.error('Failed To Update the scam DB: ' + e);
	}

	// Code for updating SERVER db
	try {
		let serverAPIRESP = await axios.get(config.scams.serverApi, {
			headers: {
				'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158',
			}
		});

		await fs.writeFile(serverDBPath, JSON.stringify(serverAPIRESP.data))
		serverdb = serverAPIRESP.data;
		lastUpdate = new Date();
		console.info('Updated server DB!');
	} catch (e) {
		serverdb = require(serverDBPath)
		console.error('Failed To Update the server DB: ' + e);
	}
};