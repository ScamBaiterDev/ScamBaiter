import { SlashCommandBuilder } from '@discordjs/builders';
const revision = require("child_process")
	.execSync("git rev-parse HEAD")
	.toString()
	.trim()
	.slice(0, 6);
const startup = new Date();
import os from "os";
import config from "../../config.json";
import Discord from "discord.js";
import { CommandData } from '../types';
import { db, lastUpdate } from '../bot';


module.exports = {
	data: new SlashCommandBuilder()
		.setName('botinfo')
		.setDescription('Shows information about the bot.'),
	async execute(bot, interaction) {
		await interaction.deferReply();
		const guildeSizes = await bot.shard?.fetchClientValues("guilds.cache.size") as number[];

		const hostname = config.owners.includes(interaction.user.id) === true ? os.hostname() : os.hostname().replace(/./g, "•");
		const systemInformation = `
					Hostname: ${hostname}
					CPU: ${os.cpus()[0].model}
					Total RAM: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
					Free RAM: ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB
					Uptime: <t:${Math.floor(
			Date.now() / 1000 - os.uptime()
		)}:R>
					`;

		const botInfo = `
					Bot Name: "${bot.user?.tag}"
					Guild Count: ${guildeSizes?.reduce((a: number, b: number) => a + b, 0)}
					Shard Count: ${bot.shard?.count}
					Shard Latency: ${Math.round(bot.ws.ping)}ms
					Startup Time: <t:${Math.floor(
			startup.getTime() / 1000
		)}:D> <t:${Math.floor(
			startup.getTime() / 1000
		)}:T>
					Current DB size: ${db.length.toString()}
					Last Database Update: <t:${Math.floor(
			lastUpdate!.getTime() / 1000
		)}:R>
					`;

		const botInfoEmbed = new Discord.EmbedBuilder()
			.setTitle("Bot Info")
			.setFields([
				{
					inline: false,
					name: "System Information",
					value: systemInformation
				},
				{
					inline: false,
					name: "Bot Info",
					value: botInfo
				},
			])
			.setFooter({
				text: `Commit ${revision}`,
			})
			.setTimestamp();

		return interaction.editReply({ embeds: [botInfoEmbed] });
	}
} as CommandData;