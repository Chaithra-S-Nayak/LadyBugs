import { client, publicSDK } from '@devrev/typescript-sdk';
import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';

// Main function to handle the event
export async function generate_report(event: any) {
  try {
    // Step 1: Validate inputs
    const devrevPAT = event.context.secrets['service_account_token'];
    const slackToken = event.context.secrets['slack_api_token'];
    const llmApiKey = event.context.secrets['llm_api_token'];
    const APIBase = event.execution_metadata.devrev_endpoint;
    const timeframe = event.input_data.timeframe || 24; // Default to 24 hours
    const channel = event.input_data.configurations['default_channel'] || '#general';

    if (!devrevPAT || !slackToken || !llmApiKey) {
      throw new Error('Missing required secrets: service_account_token, slack_api_token, or llm_api_token.');
    }

    // Step 2: Initialize DevRev SDK
    const devrevSDK = client.setup({
      endpoint: APIBase,
      token: devrevPAT,
    });

    // Step 3: Fetch closed and won opportunities
    // const opportunities = await devrevSDK.worksList({
    //   limit: 100,
    //   type: [publicSDK.WorkType.Opportunity],
    //   filters: {
    //     status: 'closed-won',
    //     updated_at: {
    //       after: new Date(Date.now() - timeframe * 60 * 60 * 1000).toISOString(), // Timeframe in hours
    //     },
    //   },
    // });

    if (!opportunities) {
      return 'No closed-won opportunities found in the specified timeframe.';
    }

    // Step 4: Generate summary using OpenAI
    const summary = await generateSummary(opportunities, llmApiKey);

    // Step 5: Post summary to Slack
    const slackResponse = await postToSlack(summary, channel, slackToken);

    return slackResponse;
  } catch (error) {
    console.error('Error handling event:', error);
    throw error;
  }
}

async function generateSummary(opportunities: any[], llmApiKey: string): Promise<string> {
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
    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [
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
}

// Function to post summary to Slack
async function postToSlack(summary: string, channel: string, slackToken: string) {
  try {
    const slackClient = new WebClient(slackToken);

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

// Main run function for handling events
export const run = async (events: any[]) => {
  for (let event of events) {
    try {
      const result = await generate_report(event);
      console.log('Event handled successfully:', result);
    } catch (error) {
      console.error('Failed to handle event:', error);
    }
  }
};

export default run;
