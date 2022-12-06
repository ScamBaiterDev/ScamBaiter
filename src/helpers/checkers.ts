import { urlRegex } from ".";
import { scamDB } from "../bot";
import { Message } from 'discord.js'
import Jimp from "jimp";
import jsQR from "jsqr";

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
    if (!attachment.contentType?.includes('image')) return;
    const image = await Jimp.read(attachment.url);
    const code = jsQR(image.bitmap.data as any, image.bitmap.width, image.bitmap.height);
    if (code === null) return;
    if (code.data.startsWith('https://discord.com/ra/') || code.data.startsWith('https://discordapp.com/ra/')) {
      message.reply({
        'embeds': [{
          'description': ':warning: POSSIBLE SCAM DETECTED :warning:\n\nThe image above contains a Discord Login QR code.\nScanning this code with the Discord app will give whoever made the code FULL ACCESS to your account',
        }]
      }).catch((err) => {
        if (err && message.deletable) message.delete();
      });
    }
  });
};