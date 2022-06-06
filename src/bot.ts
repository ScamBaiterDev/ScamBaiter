process.on("message", (msg: ShardDataSent) => {
	if (!bot.isReady()) return;
	if (!msg.type) return;

	if (msg.type === "activity") {
		console.info(msg);
		bot.user.setPresence(msg.data[0]);
	}
});

import Discord, { OAuth2Scopes, Partials } from "discord.js";
import axios from "axios";
import fs from "fs";
import WebSocket from "ws";
import config from "../config.json";
import path from "path";
import { ShardDataSent } from ".";
import { CommandData } from "./types";

export const startup = new Date();
export const prefix = "$";

const DBPath = path.join(__dirname, ".", "db.json");

const bot = new Discord.Client({
	intents: [
		"GuildMessages",
		"GuildBans",
		"GuildMembers",
		"GuildInvites",
		"Guilds",
		"MessageContent",
	],
	partials: [
		Partials.Message,
		Partials.GuildMember,
		Partials.Channel,
		Partials.ThreadMember,
		Partials.User,
	],
});

export let lastUpdate: Date | null = null;
export let lastIdPerGuild: {
	messageId: string;
	userId: string;
	guildId: string;
}[] = [];
export let reportChannel: Discord.AnyChannel | null = null;
export let db: string[] = [];
export const perferedInvite = (() => {
	if (config.inviteMsg.length > 0) return config.inviteMsg;
	return bot.generateInvite({
		permissions: ['Administrator'],
		scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands, OAuth2Scopes.ApplicationsCommandsUpdate]
	});
})();

setInterval(() => {
	updateDb();
}, 1000 * 30 * 60);

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
	const data = JSON.parse(message.data.toString());
	if (data.type === "add") {
		// Get all the entries in "data.domains" array and push to db
		data.domains.forEach((domain: string) => {
			db.push(domain);
		});
	}
};

bot.once("ready", async () => {
	if (!bot.isReady()) return;
	console.info(`Logged in as ${bot.user.tag}`);
	bot.channels.fetch(config.discord.reportChannel).then((channel) => {
		reportChannel = channel;
	});
	await updateDb();
});

bot.on("interactionCreate", async (interaction) => {
	if (!interaction.isCommand()) return;
	const command = commands.get(interaction.commandName) as CommandData;

	if (!command) return;

	try {
		await command.execute(bot, interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});


bot.on("messageCreate", async (message) => {
	if (message.author.bot || message.channel.type === Discord.ChannelType.DM)
		return;

	const args = message.content.slice(prefix.length).trim().split(/ +/g);
	const cmd = args.shift()?.toLowerCase();


	const scamUrls = message.content.match(
		/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g
	);

	if (scamUrls !== null && cmd !== "check") {
		let isScam = false;
		let scamDomain = "";

		for (const potscamurl of scamUrls) {
			if (cmd === "check") break;
			// remove everything after the third slash
			const removeEndingSlash = potscamurl.split("/")[2];
			if (removeEndingSlash === undefined) continue;
			const splited = removeEndingSlash.split(".");
			const domain =
				splited[splited.length - 2] + "." + splited[splited.length - 1];

			// check if domain is in db
			if (db.includes(domain)) {
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
						data.userId === message.member?.id &&
						data.guildId === message.guild?.id
				)
			) {
				// Remove the element from the array
				lastIdPerGuild = lastIdPerGuild.filter(
					(id) => id.messageId !== message.id
				);
				return;
			} else {
				// If the message is not in the array, add it
				lastIdPerGuild.push({
					messageId: message.id,
					userId: message.author.id,
					guildId: message.guild?.id!,
				});
			}

			if (reportChannel?.isTextBased()) {
				reportChannel.send({
					embeds: [
						{
							timestamp: Date.now().toString(),
							author: {
								name: message.guild!.name,
								icon_url: message.guild!.iconURL()!,
							},
							thumbnail: { url: message.author.avatarURL()! },
							footer: {
								text: `${message.id}${message.member?.bannable &&
										!message.member.permissions.has("KickMembers")
										? " | Softbanned"
										: " | Not Softbanned"
									}`,
							},
							fields: [
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
							],
						},
					],
				}).then(async (reportMsg) => {
					if (reportChannel?.type === Discord.ChannelType.GuildNews || reportChannel?.type === Discord.ChannelType.GuildNewsThread) {
						await reportMsg.crosspost();
					}
				});
			}
		}
	}
});

/*
	// Funky debug commands
	if (message.content.toLowerCase().startsWith(prefix)) {
		switch (cmd) {
			case "botinfo":
				bot.shard.fetchClientValues("guilds.cache.size").then((guildSizes) => {
					const hostname = config.owners.includes(message.author.id) === true ? os.hostname() : os.hostname().replace(/./g, "•");
					const systemInformationButReadable = `
					Hostname: ${hostname}
					CPU: ${os.cpus()[0].model}
					Total RAM: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
					Free RAM: ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB
					Uptime: <t:${Math.floor(
						new Date() / 1000 - os.uptime()
					)}:R>
					`;

					const botInfoButReadable = `
					Bot Name: "${bot.user.tag}"
					Guild Count: ${guildSizes.reduce((a, b) => a + b, 0)}
					Shard Count: ${bot.shard.count}
					Shard Latency: ${Math.round(bot.ws.ping)}ms
					Startup Time: <t:${Math.floor(
						startup.getTime() / 1000
					)}:D> <t:${Math.floor(
						startup.getTime() / 1000
					)}:T>
					Current DB size: ${db.length.toString()}
					Last Database Update: <t:${Math.floor(
						lastUpdate.getTime() / 1000
					)}:R>
					`;

					message.channel
						.send({
							embeds: [{
								"title": "Bot Info",
								"timestamp": new Date(),
								"fields": [
									{
										"name": "System Information",
										"value": systemInformationButReadable
									},
									{
										"name": "Bot Info",
										"value": botInfoButReadable
									}
								],
								"footer": {
									"text": `Commit ${revision}`
								}
							}],
						})
						.catch((err) => {
							console.error(err);
						});
				});
				break;
			case "update":
				if (!config.owners.includes(message.author.id)) return;
				message.channel.send("Updating...").then((msg1) => {
					updateDb()
						.then(() => msg1.edit("Updated Database"))
						.catch(() => msg1.edit("Failed to Update Database"));
				});
				break;
			case "invite":
				await message.reply(config.inviteMsg);
				break;
			case "check":
				if (!args[0])
					return message.reply(
						`Please provide a domain name to check, not the full URL please\nExample: \`${prefix}check discordapp.com\``
					);
				await message.reply("Checking...").then((msg1) =>
					msg1
						.edit(`${args[0]} is ${db.includes(args[0]) ? "" : "not "}a scam.`)
						.catch(() => {
							msg1.edit(
								"An error occurred while checking that domain name!\nTry again later"
							);
						})
				);
				break;
		}
	}
});
*/
const updateDb = () => {
	return new Promise<string[]>(async (resolve, reject) => {
		try {
			let scamAPIRESP = await axios.get(config.scamApi, {
				headers: {
					"User-Agent": "ScamBaiter/1.0; Chris Chrome#9158",
					// Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
				},
			});

			fs.writeFileSync(DBPath, JSON.stringify(scamAPIRESP.data));
			db = scamAPIRESP.data;
			lastUpdate = new Date();
			console.info("Updated DB!");
			resolve(scamAPIRESP.data);
		} catch (e) {
			db = require(DBPath);
			console.error("Failed To Update the DB: " + e);
			reject();
		}
	});
};
