import Discord from 'discord.js';
import path from 'path';
import config from "./config.json";

const manager = new Discord.ShardingManager(path.join(__dirname, '.', 'bot.js'), {
	token: config.discord.token
});

manager.on('shardCreate', shard => {
	console.log(`Launched shard ${shard.id}`)
	shard.on("ready", () => {
		console.log(`[DEBUG/SHARD] Shard ${shard.id} connected to Discord's Gateway.`)
		// Sending the data to the shard.
		shard.send({
			type: "activity",
			data: {
				status: config.discord.status.status,
				activities: [{
					type: config.discord.status.activities[0].type,
					name: `${config.discord.status.activities[0].name} | Shard ${shard.id.toString()}`
				}]
			}
		});
	})
});

manager.spawn(config.discord.shardConfig);

export interface ShardData {
	type: 'activity';
	data: Discord.PresenceData;
}