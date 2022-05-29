const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Gives the bot invite link.'),
	async execute(bot, thing) {
		let invite = bot.config.invite ?? bot.generateInvite({
			permissions: ["ADMINISTRATOR"],
			scopes: ["bot", "applications.commands"]
		});

		return thing.reply(invite);
	}
}