const { SlashCommandBuilder } = require('@discordjs/builders');
const revision = require("child_process")
	.execSync("git rev-parse HEAD")
	.toString()
	.trim()
	.slice(0, 6);
const startup = new Date();
const os = require("os");
const config = require("../config.json");
const xbytes = require("xbytes");
const Discord = require("discord.js");


module.exports = {
	data: new SlashCommandBuilder()
		.setName('botinfo')
		.setDescription('Shows information about the bot.'),
	async execute(bot, thing) {
		const invite = (() => {
			if (bot.config.invite.length > 0) return bot.config.invite;
			return bot.generateInvite({
				permissions: ["ADMINISTRATOR"],
				scopes: ["bot", "applications.commands"]
			});
		})();

		let hostname = os.hostname();
		if (typeof thing === Discord.CommandInteraction) {
			await thing.deferReply();

			if (!config.owners.includes(thing.user.id)) {
				hostname = hostname.replace(/./g, "•");
			}
		} else {
			if (!config.owners.includes(thing.author.id)) {
				hostname = hostname.replace(/./g, "•");
			}
		}

		const guildeSize = await bot.shard.fetchClientValues("guilds.cache.size");

		const botInfoEmbed = new Discord.MessageEmbed()
			.setTitle("Bot Info")
			.setFields([
				{
					inline: false,
					name: "System Information",
					value: `Hostname: ${hostname}\nStarted <t:${Math.floor(
							new Date() / 1000 - os.uptime()
						)}:R>\nPlatform: ${os.platform
						} ${os.release()}\nMemory: ${xbytes(
							os.totalmem() - os.freemem()
						)}/${xbytes(os.totalmem())}`,
				},
				{
					inline: false,
					name: "Bot Info",
					value: `Guild Count: ${guildeSize
						.reduce((a, b) => a + b, 0)
						.toString()}\nCurrent DB size: ${bot.db.length.toString()}\nStartup Time: <t:${Math.floor(
							startup.getTime() / 1000
						)}:D> <t:${Math.floor(
							startup.getTime() / 1000
						)}:T>\nLast Database Update was <t:${Math.floor(
							bot.lastUpdate.getTime() / 1000
						)}:R>`,
				},
			])
			.setFooter({
				text: `Commit ${revision} | Please reinvite using ${invite} for slashcommands to work as message commands are being deprecated.`,
			})
			.setTimestamp();

			if (typeof thing === Discord.CommandInteraction) return thing.editReply({ embeds: [botInfoEmbed], ephemeral: true });
			else return thing.reply({ embeds: [botInfoEmbed], ephemeral: true });
	}
}