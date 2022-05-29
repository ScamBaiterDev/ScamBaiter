const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('check')
		.setDescription('Checks a provided scam URL against the database.')
		.addStringOption((option) =>
			option.setName("scam_url").setDescription("The domain to check.").setRequired(true)
		),
	async execute(bot, thing, args) {
		let urlToCheck;
		if (typeof thing === Discord.CommandInteraction) {
			urlToCheck = thing.options.getString("scam_url", true);
		} else {
			if (args[0]) urlToCheck = args[0];
			else return thing.reply("Please provide a scam URL to check.");
		}
		let scamDomain;
		try {
			scamDomain = new URL(urlToCheck).hostname;
		} catch (e) {
			return thing.reply({ content: "Invalid URL", ephemeral: true });
		}

		await thing.reply({ content: "Checking...", ephemeral: true }).then(thing2 => {
			const editContent = `${scamDomain} is ${bot.db.includes(scamDomain) ? "" : "not "}a scam.`;
			if (typeof thing === Discord.CommandInteraction) return thing.editReply({ content: editContent, ephemeral: true });
			else return thing2.edit({ content: editContent, ephemeral: true });
		});
	}
}