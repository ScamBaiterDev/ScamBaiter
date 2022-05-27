const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require("../config.json");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('check')
		.setDescription('Checks a provided scam URL against the database.')
		.addStringOption((option) =>
			option.setName("scam_url").setDescription("The domain to check.").setRequired(true)
		),
	async execute(bot, interaction) {
		const urlToCheck = interaction.options.getString("scam_url", true);
		let scamDomain;
		try {
			scamDomain = new URL(urlToCheck).hostname;
		} catch (e) {
			return interaction.reply({ content: "Invalid URL", ephemeral: true });
		}

		await interaction.reply({ content: "Checking...", ephemeral: true });
		return interaction.editReply({ content: `${scamDomain} is ${bot.db.includes(scamDomain) ? "" : "not "}a scam.`, ephemeral: true });
	}
}