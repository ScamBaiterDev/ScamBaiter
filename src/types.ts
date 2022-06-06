import { APIMessage, CacheType, Client, CommandInteraction, SlashCommandBuilder } from "discord.js";

export interface CommandData {
	data: SlashCommandBuilder;
	execute(bot: Client, message: CommandInteraction<CacheType> ): unknown
}