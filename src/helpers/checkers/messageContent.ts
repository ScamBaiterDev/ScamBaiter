import { WebhookClient, Message, EmbedBuilder } from "discord.js";
import config from "../../../config.json";
import { lastIdPerGuild } from "../..";
import { checkForScamInvites } from "./invites";
import { checkForScamLinks } from './links';

const reportHook = new WebhookClient({ url: config.discord.reportHook })

export const checkMessageContent = async (message: Message) => {
  try {
    const { scamLinks, scamInvites } = await extractScamData(message);
    if (!scamLinks || !scamInvites.badInvites) return false;

    if (message.deletable) message.delete();

    const isUserInHistory = handleUserHistory(message);
    if (isUserInHistory) return;

    const embed = createEmbed(message, scamLinks, scamInvites);
    await reportHook.send({ embeds: [embed] });

    if (shouldBanUser(message)) {
      await softbanUser(message);
      return true;
    }
    return false;
  } catch (error) {
    console.log(JSON.stringify(error, null, 2));
  };
  return false;
}

const extractScamData = async (message: Message) => {
  const scamInvites = await checkForScamInvites(message.client, message.content);
  const scamLinks = checkForScamLinks(message.content);
  return { scamLinks, scamInvites };
}

const handleUserHistory = (message: Message) => {
  const userInHistory = lastIdPerGuild.find(
    (data) =>
      data.userID === message.member?.id && data.guildID === message.guild?.id
  );
  if (userInHistory) {
    // Remove the element from the array
    const fitlered = lastIdPerGuild.filter((data) => data.messageID !== message.id);
    lastIdPerGuild.length = 0;
    lastIdPerGuild.push(...fitlered);
    return true;
  } else {
    // If the message is not in the array, add it
    lastIdPerGuild.push({
      messageID: message.id,
      userID: message.author.id,
      guildID: message.guild?.id ?? '',
    });
  }
  return false;
};

const createEmbed = (message: Message, scamLinks: string[], scamInvites: Awaited<ReturnType<typeof checkForScamInvites>>) => {
  console.log(scamInvites, scamLinks)
  const embed = new EmbedBuilder()
    .setAuthor({
      name: message.guild?.name ?? '',
      iconURL: message.guild?.iconURL() ?? ''
    })
    .setThumbnail(message.author.avatarURL())
    .setFooter({
      text: `${message.id}${message.member?.bannable &&
        !message.member.permissions.has('KickMembers')
        ? ' | Softbanned'
        : ' | Not Softbanned'
        }`
    })
    .setFields([
      {
        name: 'User',
        value: `${message.author} (${message.author.tag})\nID: ${message.author.id}`,
      },
      {
        name: 'Message',
        value: message.content,
      },
      {
        name: scamInvites.badInvites !== undefined ? 'Invite' : 'Links',
        value: scamInvites.badInvites !== undefined ? `https://discord.gg/${scamInvites.invite}` : scamLinks.join('\n'),
      }
    ]).setTimestamp(new Date());

  return embed;
}

const softbanUser = async (message: Message) => {
  await message.author.send(config.discord.banMsg.replace('{guild}', message.guild?.name ?? ''));
  await message.member?.ban({
    reason: 'Scam detected',
    deleteMessageDays: 1
  });
  await message.guild?.bans.remove(message.author.id, 'AntiScam - Softban');
};

const shouldBanUser = (message: Message) =>
  message.member?.bannable && !message.member.permissions.has('KickMembers');
