const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Gives the bot invite link.'),
	async execute(bot, thing) {
		const invite = (() => {
			if (bot.config.invite.length > 0) return bot.config.invite;
			return bot.generateInvite({
				permissions: 84992,
				scopes: ["bot", "applications.commands"]
			});
		})();

		return thing.reply(invite);
	}
}