process.on("message", (msg) => {
	if (!msg.type) return false;

	if (msg.type === "activity") {
		console.info(msg);
		bot.user.setPresence(msg.data);
	}
});

const Discord = require("discord.js");
const axios = require("axios");
const fs = require("node:fs");
const WebSocket = require("ws");
const config = require("./config.json");
const path = require("node:path");

const DBPath = path.join(__dirname, ".", "db.json");

const bot = new Discord.Client({
	intents: [
		"GUILD_MESSAGES",
		"GUILD_BANS",
		"GUILD_MEMBERS",
		"GUILD_INVITES",
		"GUILDS",
	],
	partials: ["MESSAGE", "USER", "GUILD_MEMBER"],
});

bot.lastUpdate = null;
let lastIdPerGuild = [];
let reportChannel = null;
bot.db = [];
bot.config = config;

setInterval(() => {
	bot.updateDB();
}, 1000 * 30 * 60);

const sock = new WebSocket("wss://phish.sinking.yachts/feed", {
	headers: {
		"User-Agent": "ScamBaiter/1.0; Chris Chrome#9158",
		"X-Identity": "ScamBaiter/1.0; Chris Chrome#9158",
	},
});

sock.onopen = () => {
	console.log("Connected to WS");
};

sock.onmessage = (message) => {
	const data = JSON.parse(message.data);
	if (data.type === "add") {
		// Get all the entries in "data.domains" array and push to db
		data.domains.forEach((domain) => {
			bot.db.push(domain);
		});
	}
};

const commands = new Discord.Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

(async () => {
	await bot.login(config.discord.token);

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);

		commands.set(command.data.name, command);
	}
})();


bot.once("ready", async () => {
	console.info(`Logged in as ${bot.user.tag}`);
	bot.channels.fetch(config.discord.reportChannel).then((channel) => {
		reportChannel = channel;
	});
	await bot.updateDB();
});

bot.on("messageCreate", async (message) => {
	if (message.author.bot) return;

	// Seperate Command and Arguments
	const args = message.content.slice(1).split(/ +/);
	const commandName = args.shift().toLowerCase();

	const command = commands.get(commandName);

	if (!command) {
		const cleanMessage = message.content.replace(/\*|_|~|`|<|>|\|/g, "").split("\n");

		let isScam = false;
		let scamDomain = "";
		for (const potscamurl of cleanMessage) {
			// remove everything after the third slash
			const removeEndingSlash = potscamurl.split("/")[2];
			if (removeEndingSlash === undefined) continue;
			const splited = removeEndingSlash.split(".");
			const domain =
				splited[splited.length - 2] + "." + splited[splited.length - 1];

			// check if domain is in db
			if (bot.db.includes(domain)) {
				isScam = true;
				scamDomain = domain;
				break;
			}

		}

		if (isScam) {
			if (message.deletable) await message.delete();

			// Check if any of the elements in lastIdPerGuild matches the message id and guild id
			if (
				lastIdPerGuild.find(
					(data) =>
						data.userId === message.member.id && data.guildId === message.guild.id
				)
			) {
				// Remove the element from the array
				lastIdPerGuild = lastIdPerGuild.filter((id) => id.id !== message.id);
				return;
			} else {
				// If the message is not in the array, add it
				lastIdPerGuild.push({
					messageId: message.id,
					userId: message.author.id,
					guildId: message.guild.id,
				});
			}

			const scamEmbed = new Discord.MessageEmbed()
				.setFields([
					{
						name: "User",
						value: `${message.author} (${message.author.tag})\nID: ${message.author.id}`,
					},
					{
						name: "Message",
						value: message.content,
					},
					{
						name: "URL",
						value: scamDomain,
					},
				])
				.setAuthor({
					name: message.guild.name,
					icon_url: message.guild.iconURL(),
				})
				.setThumbnail(message.author.avatarURL())
				.setFooter({
					text: `${message.id}${message.member.bannable &&
						!message.member.permissions.has("KICK_MEMBERS")
						? " | Softbanned"
						: " | Not Softbanned"
						}`,
				})
				.setTimestamp();

			await reportChannel.send({ embeds: [scamEmbed] }).then((reportMsg) => {
				if (reportChannel.type === "GUILD_NEWS") {
					reportMsg.crosspost();
				}
			});

			if (
				message.member.bannable &&
				!message.member.permissions.has("KICK_MEMBERS")
			) {
				try {
					await message.author.send(
						config.discord.banMsg.replace("{guild}", message.guild.name)
					);
					await message.member.ban({ reason: "Scam detected", days: 1 });
					await message.guild.bans.remove(message.author.id, "AntiScam - Softban");
					return;
				} catch (e) {
					console.error(e);
				}
			}
		}
	}

	// Check if contains prefix
	if (!message.content.startsWith('$')) return;

	if (!command) return;

	try {
		await command.execute(bot, message, args);
	} catch (error) {
		console.error(error);
		await message.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

bot.on('interactionCreate', async (interaction) => {
	if (!interaction.isCommand()) return;

	const command = commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(bot, interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

bot.updateDB = () => {
	return new Promise(async (resolve, reject) => {
		try {
			let scamAPIRESP = await axios.get(config.scamApi, {
				headers: {
					"User-Agent": "ScamBaiter/1.0; Chris Chrome#9158",
					// Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
				},
			});

			fs.writeFileSync(DBPath, JSON.stringify(scamAPIRESP.data));
			bot.db = scamAPIRESP.data;
			bot.lastUpdate = new Date();
			console.info("Updated DB!");
			resolve();
		} catch (e) {
			bot.db = require(DBPath);
			console.error("Failed To Update the DB: " + e);
			reject();
		}
	});
};
