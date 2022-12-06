import path from "node:path";
import fs from "node:fs/promises"
import { Command, serverDBData } from "./types";
import * as config from '../config.json';
import { REST, Routes } from "discord.js";
import { scamDB } from "./bot";

export const urlRegex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g;
export const DiscordInviteLinkRegex = /(?:^|\b)discord(?:(?:app)?\.com\/invite|\.gg(?:\/invite)?)\/(?<code>[\w-]{2,255})(?:$|\b)/gi;
export const revision: string = require("child_process")
  .execSync("git rev-parse HEAD")
  .toString()
  .trim()
  .slice(0, 6);

export const urlDBPath = path.join(__dirname, "..", "db.json");
export const serverDBPath = path.join(__dirname, "..", "server_db.json");

export const loadCommands = async () => {
  const commandFiles = (await fs
    .readdir(path.join(__dirname, "commands")))
    .filter((file) => file.endsWith(".js"));

  const commands: Command[] = [];

  for await (const file of commandFiles) {
    const command = (await import(`./commands/${file}`)).default as Command;
    commands.push(command);
  }

  await updateSlashCommandData(commands).then(() => {
    console.log("Successfully registered application (/) commands.");
  });
  return commands;
};

const updateSlashCommandData = async (commands: Command[]) => {
  const data = commands.map((command) => command.data.toJSON());

  const rest = new REST({ version: "9" }).setToken(config.discord.token);

  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(
      Routes.applicationCommands(config.discord.client_id),
      { body: data }
    );

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
};

export const updateDatabase = async (scamDB: string[], serverDB: serverDBData) => {
  // Update Scam DB
  const scamAPIResponse = await fetch(config.scams.scamApi, {
    headers: {
      "User-Agent": "ScamBaiter/1.0; Chris Chrome#9158",
    }
  });
  const scamAPIResponseData: string[] = await scamAPIResponse.json();
  await fs.writeFile(urlDBPath, JSON.stringify(scamAPIResponseData, null, 2));
  scamDB = scamAPIResponseData;

  // Update Server DB
  const serverAPIResponse = await fetch(config.scams.serverApi, {
    headers: {
      "User-Agent": "ScamBaiter/1.0; Chris Chrome#9158",
    }
  });
  const serverAPIResponseData = await serverAPIResponse.json() as serverDBData;
  await fs.writeFile(serverDBPath, JSON.stringify(serverAPIResponseData, null, 2));
  serverDB = serverAPIResponseData;
};

export const checkForScamLinks = (urls: string): string[] => {
  const matches = urls.match(urlRegex);
  if (matches === null) return [];

  // Remove duplicates from urlRegexResults
  const uniqueUrls = [...new Set(matches)];
  return uniqueUrls.map((url) => {
    const removeEndingSlash = url.split('/')[2];
    if (removeEndingSlash === undefined) return;
    const splited = removeEndingSlash.split('.');
    const domain =
      splited[splited.length - 2] + '.' + splited[splited.length - 1];
    if (scamDB.includes(domain)) return domain;
  }).filter((domain) => domain !== undefined) as string[];
};
