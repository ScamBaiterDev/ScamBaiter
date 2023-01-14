import path from "node:path";
import fs from "node:fs/promises"
import type { Command, serverDBData } from "../types";
import * as config from '../../config.json';
import { REST, Routes } from "discord.js";

export const revision: string = require("child_process")
  .execSync("git rev-parse HEAD")
  .toString()
  .trim()
  .slice(0, 6);

export const urlDBPath = path.join(__dirname, "..", "db.json");
export const serverDBPath = path.join(__dirname, "..", "server_db.json");

export const loadCommands = async () => {
  const commandFiles = (await fs
    .readdir(path.join(__dirname, '..', "commands")))
    .filter((file) => file.endsWith(".js"));

  const commands: Command[] = [];

  for await (const file of commandFiles) {
    const command = (await import(path.join(__dirname, '..', "commands", file))).default as Command;
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
  scamDB.length = 0;
  scamDB.push(...scamAPIResponseData);

  // Update Server DB
  const serverAPIResponse = await fetch(config.scams.serverApi, {
    headers: {
      "User-Agent": "ScamBaiter/1.0; Chris Chrome#9158",
    }
  });
  const serverAPIResponseData = await serverAPIResponse.json() as serverDBData;
  await fs.writeFile(serverDBPath, JSON.stringify(serverAPIResponseData, null, 2));
  serverDB.length = 0;
  serverDB.push(...serverAPIResponseData);
};
