import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandData } from '../types';
import { perferedInvite } from '../bot'

module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Gives the bot invite link.'),
	async execute(bot, interaction) {
		return interaction.reply(perferedInvite);
	}
} as CommandData;