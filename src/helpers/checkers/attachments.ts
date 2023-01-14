import type { Message } from "discord.js";
import Jimp from "jimp";
import qrscanner from "qr-scanner";


export const checkAttachments = async (message: Message) => {
  try {
    const isScam = message.attachments.some(async (attachment) => {
      if (!attachment.contentType?.includes('image') || attachment.url.endsWith('webp') || attachment.url.endsWith('webm')) return false;
      const image = await Jimp.read(attachment.url);
      const code = await qrscanner.scanImage(await createImageBitmap(image.bitmap as any), { returnDetailedScanResult: true });
      if (!code.data.startsWith('https://discord.com/ra/') || !code.data.startsWith('https://discordapp.com/ra/')) return false;
      return true
    });

    if (isScam) {
      message.reply({
        'embeds': [{
          'description': ':warning: POSSIBLE SCAM DETECTED :warning:\n\nThe image above contains a Discord Login QR code.\nScanning this code with the Discord app will give whoever made the code FULL ACCESS to your account',
        }]
      }).catch((err) => {
        if (err && message.deletable) message.delete();
      });
    }
    return isScam;
  } catch (err) {
    console.error("Error while checking attachments: ", err);
    return false
  }
};
