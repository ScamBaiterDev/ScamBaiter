const Discord = require('discord.js');
const { discord } = require("./config.json");
const path = require("path");

const manager = new Discord.ShardingManager(path.join(__dirname, '.', 'bot.js'), {

manager.on('shardCreate', shard => {
	console.log(`Launched shard ${shard.id}`)
	shard.on("ready", () => {
		console.log(`[DEBUG/SHARD] Shard ${shard.id} connected to Discord's Gateway.`)
		// Sending the data to the shard.
		shard.send({
			type: "activity",
			data: {
				status: discord.status.status,
				activities: [{
					type: discord.status.activities[0].type,
					name: `${discord.status.activities[0].name} | Shard ${shard.id.toString()}`
				}]
			}
		});
	})
});

manager.spawn();