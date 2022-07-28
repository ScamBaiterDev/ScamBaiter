import type { CommandInteraction, SlashCommandBuilder, Message } from 'discord.js'

export interface Command {
    data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
    chatInputRun: (interaction: CommandInteraction) => Promise<unknown> | unknown;
    messageRun: (message: Message, args: string[]) => Promise<unknown> | unknown;
}
