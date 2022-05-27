const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require("../config.json");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('update_db')
		.setDescription('Updates database'),
	async execute(bot, interaction) {
		if (!config.owners.includes(interaction.user.id)) return;
		await interaction.reply("Updating database...");
		return await bot.updateDB().then(() => {
			return interaction.editReply("Database updated!");
		}).catch(() => {
			return interaction.editReply("Database update failed!");
		});;
	}
}