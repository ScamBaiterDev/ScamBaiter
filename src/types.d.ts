import type { ChatInputCommandInteraction, SlashCommandBuilder, Message } from 'discord.js'

export interface Command {
    data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
    chatInputRun: (interaction: ChatInputCommandInteraction) => Promise<unknown> | unknown;
    messageRun: (message: Message, args: string[]) => Promise<unknown> | unknown;
}
