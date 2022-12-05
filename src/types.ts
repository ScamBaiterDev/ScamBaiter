import { ChatInputCommandInteraction, Message, PresenceData, SlashCommandBuilder } from "discord.js";

export type MessageData = {
  type: string;
  data: PresenceData;
}

export type ScamWSData = {
  type: "add" | "delete";
  domains: string[];
}

export type Command = {
  data: SlashCommandBuilder;
  executeInteraction: (interaction: ChatInputCommandInteraction) => unknown;
  executeMessage: (message: Message, args: string[]) => unknown;
}

export type serverDBData = {
  match: boolean;
  reason: string;
  serverID: string;
}[];