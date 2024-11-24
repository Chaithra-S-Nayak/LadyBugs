import { betaSDK, client } from '@devrev/typescript-sdk';
import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';
const axios = require('axios');

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
const getOpportunities = async (timeframe: number, devrevPAT: string): Promise<any[]> => {
  try {
    // Fetch opportunities
    const endpoint = 'https://api.devrev.ai/works.list';
    const params = {
      limit: 100,
      type: 'opportunity'
      // Commenting out filters for now
      // 'filters[opportunity.subtype]': 'closed-won', // Adjust this based on the correct filter parameter
      // 'filters[updated_at][after]': new Date(Date.now() - timeframe * 60 * 60 * 1000).toISOString()
    };

    const headers = {
      'Authorization': `eyJhbGciOiJSUzI1NiIsImlzcyI6Imh0dHBzOi8vYXV0aC10b2tlbi5kZXZyZXYuYWkvIiwia2lkIjoic3RzX2tpZF9yc2EiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOlsiamFudXMiXSwiYXpwIjoiZG9uOmlkZW50aXR5OmR2cnYtaW4tMTpkZXZvLzJHSWxVbGo3RkY6ZGV2dS8yIiwiZXhwIjoxNzYzOTc4ODI3LCJodHRwOi8vZGV2cmV2LmFpL2F1dGgwX3VpZCI6ImRvbjppZGVudGl0eTpkdnJ2LXVzLTE6ZGV2by9zdXBlcjphdXRoMF91c2VyL2dvb2dsZS1vYXV0aDJ8MTA5NDAyMjA4MzU2OTI5NTIwMDY0IiwiaHR0cDovL2RldnJldi5haS9hdXRoMF91c2VyX2lkIjoiZ29vZ2xlLW9hdXRoMnwxMDk0MDIyMDgzNTY5Mjk1MjAwNjQiLCJodHRwOi8vZGV2cmV2LmFpL2Rldm9fZG9uIjoiZG9uOmlkZW50aXR5OmR2cnYtaW4tMTpkZXZvLzJHSWxVbGo3RkYiLCJodHRwOi8vZGV2cmV2LmFpL2Rldm9pZCI6IkRFVi0yR0lsVWxqN0ZGIiwiaHR0cDovL2RldnJldi5haS9kZXZ1aWQiOiJERVZVLTIiLCJodHRwOi8vZGV2cmV2LmFpL2Rpc3BsYXluYW1lIjoibm5tMjJjYzAxMSIsImh0dHA6Ly9kZXZyZXYuYWkvZW1haWwiOiJubm0yMmNjMDExQG5tYW1pdC5pbiIsImh0dHA6Ly9kZXZyZXYuYWkvZnVsbG5hbWUiOiJOTk0yMkNDMDExIENIQUlUSFJBIFMgTkFZQUsiLCJodHRwOi8vZGV2cmV2LmFpL2lzX3ZlcmlmaWVkIjp0cnVlLCJodHRwOi8vZGV2cmV2LmFpL3Rva2VudHlwZSI6InVybjpkZXZyZXY6cGFyYW1zOm9hdXRoOnRva2VuLXR5cGU6cGF0IiwiaWF0IjoxNzMyNDQyODI3LCJpc3MiOiJodHRwczovL2F1dGgtdG9rZW4uZGV2cmV2LmFpLyIsImp0aSI6ImRvbjppZGVudGl0eTpkdnJ2LWluLTE6ZGV2by8yR0lsVWxqN0ZGOnRva2VuL3cxYjFoZnBtIiwib3JnX2lkIjoib3JnX0t0U3F1elNtd3AwVnluaUgiLCJzdWIiOiJkb246aWRlbnRpdHk6ZHZydi1pbi0xOmRldm8vMkdJbFVsajdGRjpkZXZ1LzIifQ.pnFsZ9SS4iqZ4UbFNSLR27uFKJHRNP60OvWVmk83QMjg4y_LjWOa9srRaoxmKSTJGYrQo4FXnLICX5Fog6KuLHqYXbrfTTPhqJjgxBoTq_7lYxz_eAY0aaY7RC04GVu_h3O1qrFI53bFPw7TDIWAhckxqHSFbEC9o3h4CGSJhwfCz5_PI-uj_sCB--2Hiq591SCBjYUrGXvO_Hl4wTS6Y_NmuMD6booOEz3U5nToKxIVR9u97Ad1kZv0EcPsIP_wQlFHmmA1C-_VPJfnAUkPt2YbBrmDud3Cy1X279Qi1dRx2_5xqfduRtUGDNlHPBAa6nMheFgE1mO2SYMoRGrfcQ`, 
      'Accept': 'application/json',
      'User-Agent': 'axios/1.7.7'
    };

    const response = await axios.get(endpoint, { params, headers });
    const data = response.data;

    // Log the response to understand its structure
    console.log('API Response:', data);

    // Extract opportunities from the response
    const opportunities = data.works;

    // Ensure opportunities is an array
    if (!Array.isArray(opportunities)) {
      throw new Error('Expected an array of opportunities');
    }

    return opportunities;
  } catch (error) {
    console.error('Error fetching opportunities:');
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
  try {
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

    // Validate command parameters
    const commandParams = event.payload['parameters'];
    if (!commandParams) {
      throw new Error('No parameters provided in the event payload.');
    }

    const [timeframeRaw, channelRaw, color] = getParameters(commandParams.trim());
    const timeframe = parseInt(timeframeRaw.trim());
    const channel = channelRaw.trim();

    if (isNaN(timeframe) || timeframe <= 0) {
      throw new Error('Invalid timeframe provided.');
    }

    // Verify if channel is valid
    const isChannelValid = await verifyChannel(channel, slackClient);
    if (!isChannelValid) {
      throw new Error(`The channel ${channel} does not exist or is not accessible.`);
    }

    // Fetch opportunities
    const opportunities: Opportunity[] = await getOpportunities(timeframe, devrevPAT);

    if (!opportunities || opportunities.length === 0) {
      throw new Error(`No opportunities found in the last ${timeframe} hours.`);
    }

    // Generate summary
    const summary = await generateSummary(opportunities, llmApiKey);

    // Post summary to Slack
    const slackResponse = await postToSlack(summary, channel, slackToken, slackClient);
    console.log('Slack response:', slackResponse);
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
};

export const run = async (events: any[]) => {
  for (const event of events) {
    await generate_report(event);
  }
};

export default run;
