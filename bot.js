
process.on('message', msg => {
	if (!msg.type) return false;

	if (msg.type === 'activity') {
		console.info(msg);
		bot.user.setPresence(msg.data);
	}
});

const os = require('os');
const xbytes = require('xbytes');
const Discord = require('discord.js');
const axios = require('axios');
const fs = require('fs/promises');
const WebSocket = require('ws');
const config = require('./config.json');
const path = require('path');
const revision = require('child_process').execSync('git rev-parse HEAD').toString().trim().slice(0, 6);
const startup = new Date();

const DBPath = path.join(__dirname, '.', 'db.json');

const bot = new Discord.Client({
	intents: ['GUILD_MESSAGES', 'GUILD_BANS', 'GUILD_MEMBERS', 'GUILD_INVITES', 'GUILDS'],
	partials: ['MESSAGE', 'CHANNEL', 'GUILD_MEMBER', 'USER']
});

let lastUpdate = null;
let lastIdPerGuild = [];
let reportChannel = null;
let db = [];

setInterval(() => {
	updateDb()
}, 1000 * 30 * 60);

const sock = new WebSocket('wss://phish.sinking.yachts/feed', {
	headers: {
		'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158',
		'X-Identity': 'ScamBaiter/1.0; Chris Chrome#9158'
	}
});

sock.onopen = () => {
	console.log('Connected to WS');
}

sock.onmessage = (message) => {
	const data = JSON.parse(message.data);
	if (data.type === 'add') {
		// Get all the entries in "data.domains" array and push to db
		data.domains.forEach((domain) => {
			db.push(domain);
		});
	}
}

bot.once('ready', async () => {
	console.info(`Logged in as ${bot.user.tag}`);
	bot.channels.fetch(config.discord.reportChannel).then((channel) => {
		reportChannel = channel
	})
	await updateDb();
});
bot.on('messageCreate', async (message) => {
	if (message.author.bot) return;

	const prefix = '$';
	const content = message.content.toLowerCase();
	const args = content.slice(prefix.length).trim().split(/ +/g);
	const cmd = args.shift().toLowerCase();
	const URLs = content.match(/(https?):\/\/(\w+[\-]?\w+)?.?(\w+[\-]?\w+)?/g);

	// TODO: DM Only Commands
	if (message.channel.type === 'DM') return;
	if (URLs && db.includes(new URL(URLs.input).hostname)) {
		let isScam = false;
		for (const url of URLs) {
			if (db.includes(new URL(url).hostname)) {
				isScam = true;
				break;
			}
		}
		if (!isScam) return;
		if (message.deletable) await message.delete();

		// Check if any of the elements in lastIdPerGuild matches the message id and guild id
		if (lastIdPerGuild.find(data => data.userId === message.member.id && data.guildId === message.guild.id)) {
			// Remove the element from the array
			lastIdPerGuild = lastIdPerGuild.filter(id => id.id !== message.id);
			return;
		} else {
			// If the message is not in the array, add it
			lastIdPerGuild.push({
				messageId: message.id,
				userId: message.author.id,
				guildId: message.guild.id
			});
		}

		const scamEmbed = new Discord.MessageEmbed()
			.setFields([
				{
					name: 'User',
					value: `${message.author} (${message.author.tag})\nID: ${message.author.id}`
				},
				{
					name: 'Message',
					value: message.content
				},
				{
					name: 'URL',
					value: URLs.input
				}
			])
			.setAuthor({
				name: message.guild.name,
				icon_url: message.guild.iconURL()
			})
			.setThumbnail(message.author.avatarURL())
			.setFooter({
				text: `${message.id}${(message.member.bannable && !message.member.permissions.has("KICK_MEMBERS")) ? " | Softbanned" : " | Not Softbanned"}`
			})
			.setTimestamp();

		await reportChannel.send({ embeds: [scamEmbed] }).then(reportMsg => {
			if (reportChannel.type === "GUILD_NEWS") {
				reportMsg.crosspost();
			}
		});

		if (message.member.bannable && !message.member.permissions.has('KICK_MEMBERS')) {
			try {
				await message.author.send(config.discord.banMsg.replace('{guild}', message.guild.name));
				await message.member.ban({ reason: 'Scam detected', days: 1 });
				await message.guild.bans.remove(message.author.id, 'AntiScam - Softban');
				return;
			} catch (e) {
				console.error(e);
			}
		}
	}

	// Funky debug commands
	if (message.content.toLowerCase().startsWith(prefix)) {
		switch (cmd) {
			case 'botinfo':
				bot.shard.fetchClientValues('guilds.cache.size').then((value) => {
					message.channel.send({
						embeds: [{
							title: 'Bot Info',
							footer: {
								text: `Commit ${revision}`
							},
							fields: [{
								inline: false,
								name: 'System Information',
								value: `Hostname: ${config.owners.includes(message.author.id) ? os.hostname() : '••••••••'}\nStarted <t:${Math.floor(new Date() / 1000 - os.uptime())}:R>\nPlatform: ${os.platform} ${os.release()}\nMemory: ${xbytes(os.totalmem() - os.freemem())}/${xbytes(os.totalmem())}`
							},
							{
								inline: false,
								name: 'Bot Info',
								value: `Guild Count: ${value.reduce((a, b) => a + b, 0).toString()}\nCurrent DB size: ${db.length.toString()}\nStartup Time: <t:${Math.floor(startup.getTime() / 1000)}:D> <t:${Math.floor(startup.getTime() / 1000)}:T>\nLast Database Update was <t:${Math.floor(lastUpdate.getTime() / 1000)}:R>`
							}
							]
						}]
					}).catch((err) => {
						console.error(err)
					});
				});
				break;
			case 'update':
				if (!config.owners.includes(message.author.id)) return;
				message.channel.send('Updating...').then((msg1) => {
					updateDb().then(() => msg1.edit('Updated Database')).catch(() => msg1.edit('Failed to Update Database'))
				});
				break;
			case 'invite':
				await message.reply(config.inviteMsg);
				break;
			case 'check':
				if (!args[0]) return message.reply(`Please provide a domain name to check, not the full URL please\nExample: \`${prefix}check discordapp.com\``);
				await message.reply('Checking...').then((msg1) => (
					msg1.edit(`${args[0]} is ${db.includes(args[0]) ? '' : 'not '}a scam.`).catch(() => {
						msg1.edit('An error occurred while checking that domain name!\nTry again later');
					})
				));
				break;
		}
	}
});

bot.login(config.discord.token);

const updateDb = () => {
	return new Promise(async (resolve, reject) => {
		try {
			let scamAPIRESP = await axios.get(config.scamApi, {
				headers: {
					'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158'
					// Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
				}
			});

			await fs.writeFile(DBPath, JSON.stringify(scamAPIRESP.data));
			db = scamAPIRESP.data;
			lastUpdate = new Date();
			console.info('Updated DB!');
			resolve();
		} catch (e) {
			db = require(DBPath);
			console.error('Failed To Update the DB: ' + e);
			reject();
		}
	});
}
