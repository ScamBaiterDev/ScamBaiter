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
    setInterval(updateDb, 1000*30*60);
});


bot.on("messageCreate", (msg) => {
	if(msg.author.bot) return;
	if(db.some(link => msg.content.includes(link))) {
		console.log("fuck there goes another scammy boi");
        msg.delete().catch(() => {});
        if(msg.member.bannable && msg.member.permissions.has("KICK_MEMBERS")) {
			msg.author.send(config.discord.banMsg).finally(() => {
				msg.member.ban( { "reason": "AntiScam - Softban"} ).then((mem) => {
					mem.guild.bans.remove(mem.user, "AntiScam - Softban");
				}).catch(() => {});
			}).catch(() => {});
		}
	}
});

bot.login(config.discord.token);


function updateDb() {
	//get
	axios.get('https://phish.sinking.yachts/v2/all', {
		headers: {
			'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158'
			// Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
		}
	}).then((resp) => {
        fs.writeFileSync('./db.json', JSON.stringify(resp.data));
        console.log(`Updated db!`);
		db = resp.data;
    }).catch(() => {
		db = require("./db.json");
	});
}