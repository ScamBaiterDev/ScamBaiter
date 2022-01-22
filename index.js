const startup = new Date();
const url = require("url");
const os = require("os");
const xbytes = require("xbytes");
const Discord = require("discord.js");
const axios = require("axios").default;
const fs = require("fs");
const config = require("./config.json");
const revision = require('child_process').execSync('git rev-parse HEAD').toString().trim().slice(0,6)
const bot = new Discord.Client({
	intents: ["GUILD_MESSAGES", "GUILD_BANS", "GUILD_MEMBERS", "GUILD_INVITES", "GUILDS"]
});

var lastUpdate = null;
var reportChannel = null;
var db = {};

bot.on('ready', () => {
	console.log(`Logged in as ${bot.user.tag}`);
	bot.user.setPresence(config.discord.status);
	bot.channels.fetch(config.discord.reportChannel).then((channel) => {
		reportChannel = channel
	})
	updateDb();
	setInterval(() => {updateDb()}, 1000 * 30 * 60);
});

bot.on("messageCreate", (msg) => {
	
	// console.log(msg.content) // A couple bots keep slipping through the cracks, the domain is known to be in the database, so idfk why it's not triggering
	// EMERGENCY DEBUG STUFF
	
	if (msg.author.bot) return;
	if (msg.channel.type == "DM") return;
	db.forEach(x => {
		if (msg.content.includes("https://" + x) || msg.content.includes("http://" + x)) {
			// console.log(x);
			msg.content.replace('\n', ' ').split(' ').forEach(x => {
				// console.log(url.parse(x).hostname)
				if (url.parse(x).hostname && db.includes(url.parse(x).hostname)) {
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
									"value": url.parse(x).hostname
								}
							],
							"author": {
								"name": msg.guild.name,
								"icon_url": msg.guild.iconURL()
							},
							"timestamp": new Date(),
							"thumbnail": {
								"url": msg.author.avatarURL()
							}
						}]
					})
					console.log(url.parse(x).hostname);
					console.log("fuck there goes another scammy boi");
					msg.delete().catch(() => {});
					if (msg.member.bannable && !msg.member.permissions.has("KICK_MEMBERS")) {
						msg.author.send(config.discord.banMsg.replace("{guild}", msg.guild.name)).finally(() => {
							msg.member.ban({
								"reason": "AntiScam - Softban",
								"days": 1
							}).then((mem) => {
								mem.guild.bans.remove(mem.user, "AntiScam - Softban");
							}).catch((err) => {
								console.error(err)
							});
						}).catch((err) => {
							console.error(err)
						});
					}
				}
			});
		}
	})
	// Funky debug commands
	const prefix = "$";
	const args = msg.content.slice(prefix.length).trim().split(/ +/g);
	const cmd = args.shift().toLowerCase();
	if (msg.content.toLowerCase().startsWith(prefix)) {
		switch (cmd) {
			case "botinfo":
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
								"value": `Guild Count: ${bot.guilds.cache.size.toString()}\nCurrent DB size: ${db.length.toString()}\nStartup Time: <t:${Math.floor(startup.getTime()/1000)}:D> <t:${Math.floor(startup.getTime()/1000)}:T>\nLast Database Update was <t:${Math.floor(lastUpdate.getTime()/1000)}:R>`
							}
						]
					}]
				}).catch((err) => {
					console.log(err)
				});
				break;
			case "update":
				if(!config.owners.includes(msg.author.id)) return;
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
		}
	}
});

bot.login(config.discord.token);

const updateDb = () => {
	//get
	axios.get(config.scamApi, {
		headers: {
			'X-Identity': 'github.com/ChrisChrome/ScamBaiter',
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
