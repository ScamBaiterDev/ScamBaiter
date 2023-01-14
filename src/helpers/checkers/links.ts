import { urlRegex } from "../index";
import { scamDB } from '../../bot';

export const checkForScamLinks = (urls: string): string[] => {
  const uniqueUrls = extractUrls(urls);
  return uniqueUrls.filter(url => isScamLink(url))
};

const extractUrls = (urls: string): string[] => {
  const matches = urls.match(urlRegex);
  if (!matches) return []
  // Remove duplicates
  return [...new Set(matches)]
};

const isScamLink = (url: string): boolean => {
  const domain = extractDomain(url);
  return domain !== undefined && scamDB.includes(domain);
};

const extractDomain = (url: string): string | undefined => {
  const removeEndingSlash = url.split('/')[2];
  if (removeEndingSlash === undefined) return;
  const splited = removeEndingSlash.split('.');
  return splited[splited.length - 2] + '.' + splited[splited.length - 1];
};
