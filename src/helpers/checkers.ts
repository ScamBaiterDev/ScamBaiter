import { DiscordInviteLinkRegex, urlRegex } from ".";
import { lastIdPerGuild, scamDB, serverDB } from "../bot";
import { Client, EmbedBuilder, Message, WebhookClient } from 'discord.js'
import Jimp from "jimp";
import jsQR from "jsqr";
import { serverDBData } from '../types';
import * as config from '../../config.json';

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

export const checkAttachments = async (message: Message) => {
  message.attachments.forEach(async (attachment) => {
    if (!attachment.contentType?.includes('image')) return false;
    const image = await Jimp.read(attachment.url);
    const code = jsQR(image.bitmap.data as any, image.bitmap.width, image.bitmap.height);
    if (code === null) return false;
    if (code.data.startsWith('https://discord.com/ra/') || code.data.startsWith('https://discordapp.com/ra/')) {
      message.reply({
        'embeds': [{
          'description': ':warning: POSSIBLE SCAM DETECTED :warning:\n\nThe image above contains a Discord Login QR code.\nScanning this code with the Discord app will give whoever made the code FULL ACCESS to your account',
        }]
      }).catch((err) => {
        if (err && message.deletable) message.delete();
      });
      return true
    }

  });
  return false;
};

export const checkForScamInvites = async (client: Client, content: string): Promise<{ invite?: string | undefined; badInvites?: serverDBData | undefined; }> => {
  const inviteMatches = content.match(DiscordInviteLinkRegex);
  if (inviteMatches === null) return {
    invite: undefined,
    badInvites: undefined
  };
  const inviteCode = inviteMatches[5];
  const serverID = await client.fetchInvite(inviteCode ?? '').then((invite) => invite.guild?.id);
  const badInvites = serverDB.filter(server => serverID === server.serverID);
  if (badInvites.length === 0) return {
    invite: undefined,
    badInvites: undefined
  };
  return {
    invite: inviteCode,
    badInvites
  };
}

const reportHook = new WebhookClient({ url: config.discord.reportHook })

export const checkMessageContent = async (message: Message) => {
  const scamLinks = checkForScamLinks(message.content);
  const scamInvites = await checkForScamInvites(message.client, message.content);
  if (scamLinks.length > 0 || scamInvites.badInvites !== undefined) {
    if (message.deletable) message.delete();

    if (
      lastIdPerGuild.find(
        (data) =>
          data.userID === message.member?.id && data.guildID === message.guild?.id
      )
    ) {
      // Remove the element from the array
      const fitlered = lastIdPerGuild.filter((data) => data.messageID !== message.id);
      lastIdPerGuild.length = 0;
      lastIdPerGuild.push(...fitlered);
      return;
    } else {
      // If the message is not in the array, add it
      lastIdPerGuild.push({
        messageID: message.id,
        userID: message.author.id,
        guildID: message.guild?.id ?? '',
      });
    }

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
      .setFields(
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
      )
      .setTimestamp(new Date());

    await reportHook.send({ embeds: [embed] });

    if (
      message.member?.bannable &&
      !message.member.permissions.has('KickMembers')
    ) {
      await message.author.send(
        config.discord.banMsg.replace('{guild}', message.guild?.name ?? '')
      );
      await message.member.ban({
        reason: 'Scam detected',
        deleteMessageDays: 1
      });
      await message.guild?.bans.remove(message.author.id, 'AntiScam - Softban');
      return true;
    }
  }

  return false;
};