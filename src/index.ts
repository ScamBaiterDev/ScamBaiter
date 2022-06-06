import Discord, { ActivitiesOptions, PresenceData, PresenceStatusData } from "discord.js";
import path from "node:path"
import config from "../config.json";

const manager = new Discord.ShardingManager(path.join(__dirname, '.', 'bot.js'), {
	token: config.discord.token
});

manager.on('shardCreate', (shard) => {
	console.log(`Launched shard ${shard.id}`)
	shard.on("ready", () => {
		console.log(`[DEBUG/SHARD] Shard ${shard.id} connected to Discord's Gateway.`)
		// Sending the data to the shard.

		const data: ShardDataSent = {
			type: "activity",
			data: {
				status: config.discord.status.status as PresenceStatusData,
				activities: config.discord.status.activities as unknown as ActivitiesOptions[]
				}
			}

		shard.send(data);
	})
});

manager.spawn();

export interface ShardDataSent {
	type: string;
	data: PresenceData;
}