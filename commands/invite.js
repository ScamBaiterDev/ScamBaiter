const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require("../config.json");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Gives the bot invite link.'),
	async execute(bot, interaction) {
		const invite = bot.generateInvite({
			permissions: ["ADMINISTRATOR"],
			scopes: ["bot", "applications.commands"]
		})
		return interaction.reply(invite);
	}
}