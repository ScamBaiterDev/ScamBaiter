const Discord = require('discord.js');
const config = require("./config.json");

const manager = new Discord.ShardingManager('./bot.js', {
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