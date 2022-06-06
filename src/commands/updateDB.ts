import { SlashCommandBuilder } from '@discordjs/builders';
import config from "../../config.json";
import { CommandData } from '../types';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('update_db')
		.setDescription('Updates database'),
	async execute(bot, interaction) {
		if (!config.owners.includes(interaction.user.id)) return;
		await interaction.reply("Updating database...");
		// @ts-ignore
		return await bot.updateDB().then(() => {
			return interaction.editReply("Database updated!");
		}).catch(() => {
			return interaction.editReply("Database update failed!");
		});;
	}
} as CommandData;