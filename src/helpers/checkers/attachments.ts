import type { Message } from "discord.js";
import Jimp from "jimp";
import jsqr from "jsqr";


export const checkAttachments = async (message: Message) => {
  try {
    message.attachments.forEach(async (attachment) => {
      if (!attachment.contentType?.includes('image')) return false;
      const image = await Jimp.read(attachment.url);
      const code = jsqr(image.bitmap.data as any, image.bitmap.width, image.bitmap.height);
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
      return false
    });

    return false;
  } catch (err) {
    console.error("Error while checking attachments: ", err);
    return false
  }
};
