const { hostname, uptime, platform, release, totalmem, freemem } = require("os");
const xbytes = require("xbytes");
const { Client } = require("discord.js");
const axios = require("axios");
const { writeFile } = require("fs/promises");
const WebSocket = require("ws");
const { discord, owners, scamApi, inviteMsg } = require("../config.json");
const path = require("path");
const revision = require('child_process').execSync('git rev-parse HEAD').toString().trim().slice(0, 6);
const startup = new Date();

const DBPath = path.join(__dirname, "..", "db.json");


const client = new Client({
	intents: ["GUILD_MESSAGES", "GUILD_BANS", "GUILD_MEMBERS", "GUILD_INVITES", "GUILDS"]
});

let lastUpdate = null;
let reportChannel = null;
let db = [];

process.on("message", msg => {
	if (!msg.type) return false;

	if (msg.type === "activity") {
		console.info(msg);
		client.user.setPresence(msg.data);
	}
});

client.once('ready', async () => {
	console.log(`Logged in as ${client.user.tag}`);
	// Gonna try logging some websocket data for future implementation
	const sock = new WebSocket("wss://phish.sinking.yachts/feed", {
		headers: {
			'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158',
			'X-Identity': 'ScamBaiter/1.0; Chris Chrome#9158'
		}
	})
	sock.onopen = () => {
		console.log("Connected to WS");
	}
	
	sock.onmessage = (e) => {
		JSON.parse(e.data)
	}
	client.channels.fetch(discord.reportChannel).then((channel) => {
		reportChannel = channel
	})
	await updateDb();
	setInterval(() => {
		updateDb()
	}, 1000 * 30 * 60);
});
client.on("messageCreate", async (message) => {
	if (message.author.bot) return;

	const prefix = "$";
	const args = message.content.slice(prefix.length).trim().split(/ +/g);
	const cmd = args.shift().toLowerCase();

	// TODO: DM Only Commands
	if (message.channel.type === "DM") return;
	
	// filter the DB to see if the message content contain a SCAM URL
	for (const URL of db) {
		let URLs = message.content.match(/^https?:\/\//);
		if (URLs === null || URLs === undefined) break;
		if (URLs.input.includes(URL)) {
			reportChannel.send({
				"embeds": [{
					"color": null,
					"fields": [{
						"name": "User",
						"value": `${message.author} (${message.author.tag})\nID: ${message.author.id}`
					},
						{
							"name": "Message",
							"value": message.content
						},
						{
							"name": "URL",
							"value": URLs.input
						}
					],
					"author": {
						"name": message.guild.name,
						"icon_url": message.guild.iconURL()
					},
					"timestamp": new Date(),
					"thumbnail": {
						"url": message.author.avatarURL()
					}
				}]
			});

			if (message.deletable) await message.delete();
			if (message.member.bannable && !message.member.permissions.has('KICK_MEMBERS')) {
				try {
					await message.author.send(discord.banMsg.replace("{guild}", message.guild.name));
					await message.member.ban({ reason: "Scam detected", days: 1 });
					await message.guild.bans.remove(message.author.id, "AntiScam - Softban");
					return;
				} catch (e) {
					console.error(e);
				}
			}
		}
	}
	// Funky debug commands
	if (message.content.toLowerCase().startsWith(prefix)) {
		switch (cmd) {
			case "botinfo":
				client.shard.fetchClientValues('guilds.cache.size').then((value) => {
					message.channel.send({
						embeds: [{
							"title": "Bot Info",
							"footer": {
								"text": `Commit ${revision}`
							},
							"fields": [{
								"inline": false,
								"name": "System Information",
								"value": `Hostname: ${owners.includes(message.author.id) ? hostname() : "••••••••"}\nStarted <t:${Math.floor(new Date() / 1000 - uptime())}:R>\nPlatform: ${platform} ${release()}\nMemory: ${xbytes(totalmem() - freemem())}/${xbytes(totalmem())}`
							},
							{
								"inline": false,
								"name": "Bot Info",
								"value": `Guild Count: ${value.reduce((a, b) => a + b, 0).toString()}\nCurrent DB size: ${db.length.toString()}\nStartup Time: <t:${Math.floor(startup.getTime() / 1000)}:D> <t:${Math.floor(startup.getTime() / 1000)}:T>\nLast Database Update was <t:${Math.floor(lastUpdate.getTime() / 1000)}:R>`
							}
							]
						}]
					}).catch((err) => {
						console.error(err)
					});
				});
				break;
			case "update":
				if (!owners.includes(message.author.id)) return;
				message.channel.send("Updating...").then((msg1) => {
					updateDb().then(() => msg1.edit('Updated Database')).catch(()=> msg1.edit('Failed to Update Database'))
				});
				break;
			case "invite":
				await message.reply(inviteMsg);
				break;
			case "check":
				if (!args[0]) return message.reply(`Please provide a domain name to check, not the full URL please\nExample: \`${prefix}check discordapp.com\``);
				let msg1 = await message.reply("Checking...");
				await msg1.edit(msg1.edit(`${args[0]} is ${db.includes(args[0]) ? "" : "not "}a scam.`).catch(() => {
					msg1.edit("An error occurred while checking that domain name!\nTry again later");
				}));
				break;
		}
	}
});

client.login(discord.token);

const updateDb = () => {
	return new Promise(async (resolve, reject) => {
		try {
			let scamAPIRESP = await axios.get(scamApi, {
				headers: {
					'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158'
					// Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
				}
			});


			await writeFile(DBPath, JSON.stringify(scamAPIRESP.data));
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