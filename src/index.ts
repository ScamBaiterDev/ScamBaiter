import * as Discord from 'discord.js';
import * as config from '../config.json';
import type { MessageData } from './types';
import path from 'node:path';

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
        status: config.discord.status as unknown as Discord.PresenceStatusData,
        activities: [{
          type: config.discord.status.activities[0].type as unknown as Discord.ActivityType,
          name: config.discord.status.activities[0].name
        }]
      }
    } as MessageData);
  })
});

manager.spawn(config.discord.shardConfig);
