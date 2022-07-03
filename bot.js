process.on("message", (msg) => {
	if (!msg.type) return false;

	if (msg.type === "activity") {
		console.info(msg);
		bot.user.setPresence(msg.data);
	}
});

const urlRegex = new RegExp(/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g);

const os = require("os");
const xbytes = require("xbytes");
const Discord = require("discord.js");
const {
	REST
} = require("@discordjs/rest");
const {
	Routes
} = require('discord-api-types/v10');

const axios = require("axios");
const fs = require("fs/promises");
const WebSocket = require("ws");
const config = require("./config.json");
const path = require("path");
const revision = require("child_process")
	.execSync("git rev-parse HEAD")
	.toString()
	.trim()
	.slice(0, 6);
const startup = new Date();

const DBPath = path.join(__dirname, ".", "db.json");

const bot = new Discord.Client({
	intents: [
		"GuildMessages",
		"GuildBans",
		"GuildMembers",
		"GuildInvites",
		"Guilds",
		"MessageContent"
	],
	partials: ["MESSAGE", "CHANNEL", "GUILD_MEMBER", "USER"],
});
const Jimp = require('jimp');
const jsQR = require("jsqr");
let lastUpdate = null;
let lastIdPerGuild = [];
let reportChannel = null;
let db = [];

setInterval(() => {
	updateDb();
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
			db.push(domain);
		});
	}
};

bot.once("ready", async () => {
	console.info(`Logged in as ${bot.user.tag}`);
	bot.channels.fetch(config.discord.reportChannel).then((channel) => {
		reportChannel = channel;
	});
	await updateDb();

	const commands = [];
	const everySlashiesData = [
		new Discord.SlashCommandBuilder()
		.setName('botinfo')
		.setDescription('Shows information about the bot.'),
		new Discord.SlashCommandBuilder()
		.setName('check')
		.setDescription('Checks a provided scam URL against the database.')
		.addStringOption((option) =>
			option.setName("scam_url").setDescription("The domain to check.").setRequired(true)
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

bot.on("interactionCreate", async (interaction) => {
	if (!interaction.isCommand()) return;

	switch (interaction.commandName) {
		case "botinfo":
			bot.shard.fetchClientValues("guilds.cache.size").then((guildSizes) => {
				const hostname = config.owners.includes(interaction.user.id) === true ? os.hostname() : os.hostname().replace(/./g, "•");
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

				interaction
					.reply({
						embeds: [{
							"title": "Bot Info",
							"timestamp": new Date(),
							"fields": [{
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
		case "update_db":
			if (!config.owners.includes(interaction.user.id)) return;
			interaction.reply("Updating...").then(() => {
				updateDb()
					.then(() => interaction.editReply("Updated Database"))
					.catch(() => interaction.editReply("Failed to Update Database"));
			});
			break;
		case "invite":
			await interaction.reply(config.inviteMsg);
			break;
		case "check":
			const scamUrl = interaction.options.getString("scam_url", true);
			const matchedREgexThing = urlRegex.exec(scamUrl);
			if (matchedREgexThing) {
				const removeEndingSlash = matchedREgexThing[0].split("/")[2];
				if (removeEndingSlash === undefined) return interaction.reply("Please provide a valid URL");
				const splited = removeEndingSlash.split(".");
				const domain =
					splited[splited.length - 2] + "." + splited[splited.length - 1];
				await interaction.reply("Checking...").then(() =>
					interaction
					.editReply(`${domain} is ${db.includes(domain) ? "" : "not "}a scam.`)
					.catch(() => {
						interaction.editReply(
							"An error occurred while checking that domain name!\nTry again later"
						);
					})
				);
				return;
			}
			await interaction.reply("Checking...").then(() =>
				interaction
				.editReply(`${scamUrl} is ${db.includes(scamUrl) ? "" : "not "}a scam.`)
				.catch(() => {
					interaction.editReply(
						"An error occurred while checking that domain name!\nTry again later"
					);
				})
			);
			break;
	}
})

bot.on("messageCreate", async (message) => {
	if (message.author.id == bot.user.id) return;

	const prefix = "$";
	const args = message.content.slice(prefix.length).trim().split(/ +/g);
	const cmd = args.shift().toLowerCase();
	// QR Stuff

	const scamUrls = urlRegex.exec(message.content);
	let isScam = false;
	let scamDomain = "";
	if (scamUrls !== null && cmd !== "check") {
		for (const potscamurl of scamUrls) {
			// remove everything after the third slash
			const removeEndingSlash = potscamurl.split("/")[2];
			if (removeEndingSlash === undefined) continue;
			const splited = removeEndingSlash.split(".");
			const domain =
				splited[splited.length - 2] + "." + splited[splited.length - 1];

			// check if domain is in db
			if (db.includes(domain) || db.includes(removeEndingSlash)) {
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
				data.userId === message.member.id && data.guildId === message.guild.id
			)
		) {
			// Remove the element from the array
			lastIdPerGuild = lastIdPerGuild.filter((data) => data.messageId !== message.id);
			return;
		} else {
			// If the message is not in the array, add it
			lastIdPerGuild.push({
				messageId: message.id,
				userId: message.author.id,
				guildId: message.guild.id,
			});
		}

		await reportChannel.send({
			embeds: [{
				"timestamp": new Date(),
				"author": {
					"name": message.guild.name,
					"icon_url": message.guild.iconURL(),
				},
				"thumbnail": {
					"url": message.author.avatarURL()
				},
				"footer": {
					"text": `${message.id}${message.member.bannable &&
						!message.member.permissions.has("KickMembers")
						? " | Softbanned"
						: " | Not Softbanned"
						}`
				},
				"fields": [{
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
					}
				]
			}]
		}).then((reportMsg) => {
			if (reportChannel.type === Discord.ChannelType.GuildNews || reportChannel.type === Discord.ChannelType.GuildNewsThread) {
				reportMsg.crosspost();
			}
		});

		if (
			message.member.bannable &&
			!message.member.permissions.has("KickMembers")
		) {
			try {
				await message.author.send(
					config.discord.banMsg.replace("{guild}", message.guild.name)
				);
				await message.member.ban({
					reason: "Scam detected",
					days: 1
				});
				await message.guild.bans.remove(message.author.id, "AntiScam - Softban");
				return;
			} catch (e) {
				console.error(e);
			}
		}
	}

	message.attachments.forEach((att) => {
		if (att.contentType.startsWith("image")) {
			Jimp.read(att.attachment).then(img => {
				code = jsQR(img.bitmap.data, img.bitmap.width, img.bitmap.height);
				if (code) {
					if (code.data.startsWith("https://discord.com/ra/")) {
						// Do ban stuff
						try {
							message.reply({
								"embeds": [{
									"description": ":warning: POSSIBLE SCAM DETECTED :warning:\n\nThe image above contains a Discord Login QR code.\nScanning this code with the Discord app will give whoever made the code FULL ACCESS to your account",
									"color": null
								}]
							})
						} catch (error) {
							if(error) message.delete();
						}
					}
				}
			})
		}
	})
	message.embeds.forEach(embed => {
		if (() => {
				Jimp.read(embed.thumbnail.url).then(img => {
					code = jsQR(img.bitmap.data, img.bitmap.width, img.bitmap.height);
					if (code) {
						if (code.data.startsWith("https://discord.com/ra/")) return true;
					}
				})
				Jimp.read(embed.image.url).then(img => {
					code = jsQR(img.bitmap.data, img.bitmap.width, img.bitmap.height);
					if (code) {
						if (code.data.startsWith("https://discord.com/ra/")) return true;
					}
				})
				Jimp.read(embed.footer.iconURL).then(img => {
					code = jsQR(img.bitmap.data, img.bitmap.width, img.bitmap.height);
					if (code) {
						if (code.data.startsWith("https://discord.com/ra/")) return true;
					}
				})
				Jimp.read(embed.author.iconURL).then(img => {
					code = jsQR(img.bitmap.data, img.bitmap.width, img.bitmap.height);
					if (code) {
						if (code.data.startsWith("https://discord.com/ra/")) return true;
					}
				})
				return false;
			}) {
			try {
				message.reply({
					"embeds": [{
						"description": ":warning: POSSIBLE SCAM DETECTED :warning:\n\nThe image above contains a Discord Login QR code.\nScanning this code with the Discord app will give whoever made the code FULL ACCESS to your account",
						"color": null
					}]
				})
			} catch (error) {
				if(error) message.delete();
			}
		}
	})

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
								"fields": [{
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
				const urls = args[0];
				if (!urls)
					return message.reply(
						`Please provide a domain name to check, not the full URL please\nExample: \`${prefix}check discordapp.com\``
					);

				const matchedREgexThing = urlRegex.exec(urls);
				if (matchedREgexThing) {
					const removeEndingSlash = matchedREgexThing[0].split("/")[2];
					if (removeEndingSlash === undefined) return interaction.reply("Please provide a valid URL");
					const splited = removeEndingSlash.split(".");
					const domain =
						splited[splited.length - 2] + "." + splited[splited.length - 1];
					await message.reply("Checking...").then(() =>
						message
						.edit(`${domain} is ${db.includes(domain) ? "" : "not "}a scam.`)
						.catch(() => {
							message.edit(
								"An error occurred while checking that domain name!\nTry again later"
							);
						})
					);
					return;
				}
				await message.reply("Checking...").then((msg1) =>
					msg1
					.edit(`${urls} is ${db.includes(urls) ? "" : "not "}a scam.`)
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

bot.login(config.discord.token);

const updateDb = () => {
	return new Promise(async (resolve, reject) => {
		try {
			let scamAPIRESP = await axios.get(config.scamApi, {
				headers: {
					"User-Agent": "ScamBaiter/1.0; Chris Chrome#9158",
					// Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
				},
			});

			await fs.writeFile(DBPath, JSON.stringify(scamAPIRESP.data));
			db = scamAPIRESP.data;
			lastUpdate = new Date();
			console.info("Updated DB!");
			resolve();
		} catch (e) {
			db = require(DBPath);
			console.error("Failed To Update the DB: " + e);
			reject();
		}
	});
};