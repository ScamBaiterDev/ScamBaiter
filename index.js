const startup = new Date();
const url = require("url");
const Discord = require("discord.js");
const axios = require("axios").default;
const fs = require("fs");
const config = require("./config.json");
const bot = new Discord.Client({
	intents: ["GUILD_MESSAGES", "GUILD_BANS", "GUILD_MEMBERS", "GUILD_INVITES", "GUILDS"]
});


var db = {};

bot.on('ready', () => {
	console.log(`Logged in as ${bot.user.tag}`);
	bot.user.setPresence(config.discord.status)
	updateDb();
	setInterval(updateDb, 1000 * 30 * 60);
});


bot.on("messageCreate", (msg) => {
	if (msg.author.bot) return;
	db.forEach(x => {
		if (msg.content.includes("https://" + x) || msg.content.includes("http://" + x)) {
			// console.log(x);
			msg.content.replace('\n', ' ').split(' ').forEach(x => {
				// console.log(url.parse(x).hostname)
				if (url.parse(x).hostname && db.includes(url.parse(x).hostname)) {
					console.log(url.parse(x).hostname);
					console.log("fuck there goes another scammy boi");
					msg.delete().catch(() => {});
					if (msg.member.bannable && !msg.member.permissions.has("KICK_MEMBERS")) {
						msg.author.send(config.discord.banMsg).finally(() => {
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
				if (!config.owners.includes(msg.author.id)) return;
				msg.channel.send({
					embeds: [{
						"title": "Bot Info",
						"footer": {
							"text": "This message will self destruct in 10 seconds"
						},
						"fields": [{
								"inline": true,
								"name": "Guilds",
								"value": bot.guilds.cache.size.toString()
							},
							{
								"inline": true,
								"name": "Current DB size",
								"value": db.length.toString()
							},
							{
								"inline": true,
								"name": "Startup Time",
								"value": `<t:${Math.floor(startup.getTime()/1000)}:D> <t:${Math.floor(startup.getTime()/1000)}:T>`
							}
						]
					}]
				}).then((msg1) => {
					setTimeout(() => {
						msg.delete();
						msg1.delete();
					}, 10000)
				}).catch((err) => {
					console.log(err)
				});
				break;
		}
	}
});

bot.login(config.discord.token);


function updateDb() {
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
	}).catch(() => {
		console.log("Fetching db failed, pls fix! REEEEEEEEEEEEEEEEEEEEEEEE!");
		db = require("./db.json");
	});
}