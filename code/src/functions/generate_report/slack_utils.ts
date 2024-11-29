import { WebClient } from '@slack/web-api';

export const verifyChannel = async (channelName: string, slackToken: string): Promise<boolean> => {
  let result;
  try {
    const slackClient = new WebClient(slackToken);
    result = await slackClient.conversations.list();
  } catch (error) {
    console.error('Error fetching channels list:', error);
    throw error;
  }

  if (result.ok && result.channels) {
    const channelExists = result.channels.some((channel) => channel.name === channelName);
    return channelExists;
  } else {
    throw new Error('Failed to fetch channels list');
  }
};

export async function uploadFileToSlack(pdfBytes: Uint8Array, channelName: string, slackToken: string) {
  try {
    const slackClient = new WebClient(slackToken);
    const channelId = await getChannelIdByName(channelName, slackClient);
    if (!channelId) {
      return { ok: false, error: 'Channel not found' };
    }
    await slackClient.conversations.join({ channel: channelId });
    const buffer = Buffer.from(pdfBytes);
    const response = await slackClient.files.uploadV2({
      channel_id: channelId,
      file: buffer,
      filename: 'Business_Opportunities_Report.pdf',
      title: 'Business Opportunities Report',
    });
    return response;
  } catch (error: any) {
    console.error('Error uploading file:', error.response?.data || error.message);
    return { ok: false, error: error.response?.data || error.message };
  }
}

export async function getChannelIdByName(channelName: string, slackClient: WebClient) {
  try {
    const response = await slackClient.conversations.list();
    if (response.ok) {
      const channel = response.channels?.find((c) => c.name === channelName);
      if (channel) {
        return channel.id;
      } else {
        throw new Error(`Channel "${channelName}" not found.`);
      }
    } else {
      throw new Error('Failed to fetch channel list.');
    }
  } catch (error) {
    console.error('Error fetching channel ID:', error);
    throw error;
  }
}
