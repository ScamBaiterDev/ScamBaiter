const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require('discord.js');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('update_db')
		.setDescription('Updates database'),
	async execute(bot, thing) {
		const invite = (() => {
			if (bot.config.invite.length > 0) return bot.config.invite;
			return bot.generateInvite({
				permissions: ["ADMINISTRATOR"],
				scopes: ["bot", "applications.commands"]
			});
		})();

		let userid = thing.author.id ??=thing.user.id;
		if (!bot.config.owners.includes(userid)) return;
		await thing.reply("Updating database...").then(async (thing2) => {
			if (typeof thing === Discord.CommandInteraction) {
				return await bot.updateDB().then(() => {
					return thing.editReply("Database updated!");
				}).catch(() => {
					return thing.editReply("Database update failed!");
				});;
			} else {
				return await bot.updateDB().then(() => {
					return thing2.edit(`Database updated! \n\n Please reinvite using ${invite} for slashcommands to work as message commands are being deprecated.`);
				}).catch(() => {
					return thing2.edit(`Database update failed! \n\n Please reinvite using ${invite} for slashcommands to work as message commands are being deprecated.`);
				});;
			}
		});
	}
}