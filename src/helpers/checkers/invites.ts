import type { Client } from "discord.js";
import { serverDB } from "../..";
import type { serverDBData } from "../../types";
import { DiscordInviteLinkRegex } from "../regex";

export const checkForScamInvites = async (client: Client, content: string): Promise<{ invite?: string; badInvites?: serverDBData }> => {
  const inviteCode = extractInviteCode(content);
  if (!inviteCode) return { invite: undefined, badInvites: undefined };

  const serverID = await fetchServerID(client, inviteCode);
  if (!serverID) return { invite: undefined, badInvites: undefined };

  const badInvites = filterBadInvites(serverID);
  if (!badInvites) return { invite: undefined, badInvites: undefined };

  return { invite: inviteCode, badInvites };
};

const extractInviteCode = (content: string): string | undefined => {
  const inviteMatches = content.match(DiscordInviteLinkRegex);
  return inviteMatches?.[5];
}

const fetchServerID = async (client: Client, inviteCode: string): Promise<string | undefined> => {
  return client.fetchInvite(inviteCode)
    .then((invite) => invite.guild?.id);
};

const filterBadInvites = (serverID: string): serverDBData | undefined => {
  return serverDB.filter(server => serverID === server.serverID);
};
