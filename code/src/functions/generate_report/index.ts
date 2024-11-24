import { betaSDK, client } from '@devrev/typescript-sdk';
import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';

interface Opportunity {
  id: string;
  name: string;
  revenue: number;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const getParameters = (paramString: string): string[] => {
  const paramList = paramString.split(' ');
  if (paramList.length !== 3) {
    throw new Error('Invalid Parameters');
  }
  const [timeframe, channel, color] = paramList;
  return [timeframe, channel, color];
};

const verifyChannel = async (channelName: string, slackClient: WebClient): Promise<boolean> => {
  try {
    // Fetch the list of channels
    let result;
    try {
      result = await slackClient.conversations.list();
    } catch (error) {
      console.error('Error fetching channels list:', error);
      throw error;
    }

    if (result.ok && result.channels) {
      // Check if the channel name exists in the list
      const channelExists = result.channels.some((channel) => channel.name === channelName);
      return channelExists;
    } else {
      throw new Error('Failed to fetch channels list');
    }
  } catch (error) {
    console.error('Error verifying channel:', error);
    throw error;
  }
};
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const getOpportunities = async (timeframe: number, devrevSDK: any): Promise<any[]> => {
  try {
    // Fetch closed and won opportunities
    const opportunities = await devrevSDK.worksList({
      limit: 100,
      type: [betaSDK.WorkType.Opportunity],
      filters: {
        status: 'closed-won',
        updated_at: {
          after: new Date(Date.now() - timeframe * 60 * 60 * 1000).toISOString(),
        },
      },
    });
    return opportunities;
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    throw error;
  }
};

const generateSummary = async (opportunities: Opportunity[], llmApiKey: string): Promise<string> => {
  try {
    const openai = new OpenAI({
      apiKey: llmApiKey,
    });

    // Format data for OpenAI
    const opportunityDetails = opportunities.map((opp) => ({
      id: opp.id,
      name: opp.name,
      revenue: opp.revenue || 0,
      // TO DO : add required inputs
    }));

    // Create a prompt for OpenAI
    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content:
          'You are a business assistant that generates concise summaries of sales opportunities based on provided data.',
      },
      {
        role: 'user',
        content: `Here is a summary request for closed-won opportunities:

Opportunities:
${JSON.stringify(opportunityDetails, null, 2)}

Please summarize the following:
1. Total revenue from all closed-won opportunities.
2. The top customer by revenue.
3. The total number of closed-won opportunities.
4. A concise summary of each opportunity, including name, revenue, owner, customer, tickets, and discussions.

Provide the output in a well-structured, brief format. Avoid raw data and focus on insights.`,
      },
    ];

    // Call OpenAI to generate the summary
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || 'Summary generation failed.';
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
};

// Function to post summary to Slack
async function postToSlack(summary: string, channel: string, slackToken: string, slackClient: WebClient) {
  try {
    const response = await slackClient.chat.postMessage({
      channel: channel,
      text: `Opportunity Summary:\n${summary}`,
    });

    return response;
  } catch (error) {
    console.error('Error posting to Slack:', error);
    throw error;
  }
}

const generate_report = async (event: any) => {
  // Step 1: Validate inputs
  const devrevPAT = event.context.secrets['service_account_token'];
  const slackToken = event.context.secrets['slack_api_token'];
  const llmApiKey = event.context.secrets['llm_api_token'];
  const endpoint = event.execution_metadata.devrev_endpoint;

  if (!devrevPAT || !slackToken || !llmApiKey) {
    throw new Error('Missing required secrets: service_account_token, slack_api_token, or llm_api_token.');
  }

  // Step 2: Initialize DevRev SDK
  const devrevSDK = client.setup({
    endpoint: endpoint,
    token: devrevPAT,
  });

  const slackClient = new WebClient(slackToken);

  const commandParams = event.payload['parameters'];
  const [timeframe, channel, color] = getParameters(commandParams);

  // Verify if channel is valid
  const isChannelValid = await verifyChannel(channel, slackClient);
  if (!isChannelValid) {
    throw new Error(`The channel ${channel} does not exist.`);
  }

  // Fetch opportunities
  const opportunities: Opportunity[] = await getOpportunities(parseInt(timeframe), devrevSDK);

  // Generate summary
  await generateSummary(opportunities, llmApiKey);

  // Post summary to Slack
  await postToSlack('Summary', channel, slackToken, slackClient);
};

export const run = async (events: any[]) => {
  for (const event of events) {
    await generate_report(event);
  }
};

export default run;
