const startup = new Date();
const url = require("url");
const os = require("os");
const xbytes = require("xbytes");
const Discord = require("discord.js");
const axios = require("axios").default;
const fs = require("fs");
const WebSocket = require("ws")
const config = require("./config.json");
const revision = require('child_process').execSync('git rev-parse HEAD').toString().trim().slice(0, 6)
const bot = new Discord.Client({
	intents: ["GUILD_MESSAGES", "GUILD_BANS", "GUILD_MEMBERS", "GUILD_INVITES", "GUILDS"]
});

let lastUpdate = null;
let lastId = 0;
let reportChannel = null;
let db = [];

process.on("message", msg => {
	if (!msg.type) return false;

	if (msg.type === "activity") {
		console.log(msg)
		bot.user.setPresence(msg.data);
	}
})

bot.on('ready', () => {
	console.log(`Logged in as ${bot.user.tag}`);
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
	bot.channels.fetch(config.discord.reportChannel).then((channel) => {
		reportChannel = channel
	})
	updateDb();
	setInterval(() => {
		updateDb()
	}, 1000 * 30 * 60);
});
bot.on("messageCreate", (msg) => {
	if (msg.author.bot) return;
	const prefix = "$";
	const args = msg.content.slice(prefix.length).trim().split(/ +/g);
	const cmd = args.shift().toLowerCase();
	if (msg.channel.type === "DM") {
		return; // For future DM only commands
	};
	db.forEach(x => {
		let urls = msg.content.match(/(https?):\/\/(\w+[\-]?\w+)?.?(\w+[\-]?\w+)?/g)
		if (urls) {
			urls.forEach(y => {
				if (url.parse(y).hostname === x) {
					if (msg.author.id !== lastId) {
						lastId = msg.author.id;
						reportChannel.send({
							"embeds": [{
								"color": null,
								"fields": [{
										"name": "User",
										"value": `${msg.author} (${msg.author.tag})\nID: ${msg.author.id}`
									},
									{
										"name": "Message",
										"value": msg.content
									},
									{
										"name": "URL",
										"value": y
									}
								],
								"author": {
									"name": msg.guild.name,
									"icon_url": msg.guild.iconURL()
								},
								"timestamp": new Date(),
								"thumbnail": {
									"url": msg.author.avatarURL()
								},
								"footer": {
									"text": msg.id
								}
							}]
						})
						msg.delete().catch(() => {});
						if (msg.member.bannable && !msg.member.permissions.has("KICK_MEMBERS")) {
							msg.author.send(config.discord.banMsg.replace("{guild}", msg.guild.name)).finally(() => {
								if (msg.member == null) return;
								msg.member.ban({
									"reason": "AntiScam - Softban",
									"days": 1
								}).then((mem) => {
									setTimeout(() => {
										mem.guild.bans.remove(mem.user, "AntiScam - Softban");
									}, 500);
								}).catch((err) => {
									console.error(err)
								});
							}).catch((err) => {
								console.error(err)
							});
						}
					}
				}
			})
		}
	})
	// Funky debug commands
	if (msg.content.toLowerCase().startsWith(prefix)) {
		switch (cmd) {
			case "botinfo":
				bot.shard.fetchClientValues('guilds.cache.size').then((value) => {
					msg.channel.send({
						embeds: [{
							"title": "Bot Info",
							"footer": {
								"text": `Commit ${revision}`
							},
							"fields": [{
									"inline": false,
									"name": "System Information",
									"value": `Hostname: ${config.owners.includes(msg.author.id)?os.hostname():"••••••••"}\nStarted <t:${Math.floor(new Date()/1000 - os.uptime())}:R>\nPlatform: ${os.platform} ${os.release()}\nMemory: ${xbytes(os.totalmem()-os.freemem())}/${xbytes(os.totalmem())}`
								},
								{
									"inline": false,
									"name": "Bot Info",
									"value": `Guild Count: ${value.reduce((a, b) => a + b, 0).toString()}\nCurrent DB size: ${db.length.toString()}\nStartup Time: <t:${Math.floor(startup.getTime()/1000)}:D> <t:${Math.floor(startup.getTime()/1000)}:T>\nLast Database Update was <t:${Math.floor(lastUpdate.getTime()/1000)}:R>`
								}
							]
						}]
					}).catch((err) => {
						console.log(err)
					});
				})
				break;
			case "update":
				if (!config.owners.includes(msg.author.id)) return;
				msg.channel.send("Updating...").then((msg1) => {
					// Tried to find a better way of doing this, particularly making updateDb() into a promise, but it didn't wanna work, will work on it over time
					axios.get(config.scamApi, {
						headers: {
							'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158'
							// Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
						}
					}).then((resp) => {
						fs.writeFileSync('./db.json', JSON.stringify(resp.data));
						console.log(`Updated db!`);
						db = resp.data;
						lastUpdate = new Date();
						msg1.edit(`Updated! \`Size: ${db.length.toString()}\``);
					}).catch(() => {
						console.log("Failed to fetch database!");
						db = require("./db.json");
						msg1.edit("Failed to update!");
					});
				})
				break;
			case "invite":
				msg.reply(config.inviteMsg);
				break;
			case "check":
				if (!args[0]) return msg.reply(`Please provide a domain name to check, not the full URL please\nExample: \`${prefix}check discordapp.com\``);
				msg.reply("Checking...").then(msg1 => {
					axios.get(`https://phish.sinking.yachts/v2/check/${args[0]}`, {
						headers: {
							'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158'
							// Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
						}
					}).then((resp) => {
						msg1.edit(`${args[0]} is ${resp.data?"":"not "}a scam.`);
					})
				}).catch(() => {
					msg1.edit("An error occurred while checking that domain name!\nTry again later")
				});
				break;
		}
	}
});

bot.login(config.discord.token);

const updateDb = () => {
	//get
	axios.get(config.scamApi, {
		headers: {
			'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158'
			// Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
		}
	}).then((resp) => {
		fs.writeFileSync('./db.json', JSON.stringify(resp.data));
		console.log(`Updated db!`);
		db = resp.data;
		lastUpdate = new Date();
	}).catch(() => {
		console.log("Failed to fetch database!");
		db = require("./db.json");
	});
}