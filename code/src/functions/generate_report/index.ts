import { betaSDK, client } from '@devrev/typescript-sdk';
import { generateSummary } from './llm_utils';
import {
  beautifySummary,
  createPDFReport,
  generateDoughnutChart,
  generateOpportunityStackedBarChart,
  getOpportunityOwnerCounts,
  getOpportunityOwnerCountsByStage,
} from './pdf_utils';
import { uploadFileToSlack, verifyChannel } from './slack_utils';
import { ApiUtils } from './timeline_utils';

type HTTPResponse = {
  success: boolean;
  message: string;
  data: any;
};
interface TimeParams {
  days?: number;
  hours?: number;
  totalHours: number;
}

export interface Opportunity {
  type: any;
  actual_close_date: any;
  body: any;
  created_by: any;
  created_date: any;
  custom_fields: any;
  display_id: any;
  modified_by: any;
  modified_date: any;
  owned_by: any;
  stage: any;
  stock_schema_fragment: any;
  tags: any;
  title: any;
  id: string;
}

const parseTimeParameters = (timeString: string): TimeParams => {
  const daysMatch = timeString.match(/(\d+)d/);
  const hoursMatch = timeString.match(/(\d+)h/);
  const days = daysMatch ? parseInt(daysMatch[1]) : 0;
  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;

  if (!days && !hours) {
    throw new Error('Invalid time format. Use format: [Nd][Nh] (e.g. 1d 2h, 24h, 2d)');
  }

  return {
    days: days || undefined,
    hours: hours || undefined,
    totalHours: days * 24 + hours,
  };
};

const parseInput = (
  input: string,
  defaults: { channel: string; timeframe: string }
): {
  channel: string;
  timeParams: TimeParams;
} => {
  const parts = input.trim().split(' ');

  // Use defaults if parts are missing
  const isTimeframe = (part: string) => /^[0-9]+[dh]$/.test(part);

  const channel = isTimeframe(parts[0]) ? defaults.channel : parts[0] || defaults.channel;
  const timeframe = isTimeframe(parts[0]) ? parts[0] : parts[1] || defaults.timeframe;

  return {
    channel,
    timeParams: parseTimeParameters(timeframe),
  };
};

// Fetch opportunities from DevRev API
const getOpportunities = async (timeframe: number, devrevSDK: any) => {
  try {
    const opp = await devrevSDK.fetchOpportunities();

    const opportunities = opp.data.works;
    if (!Array.isArray(opportunities)) {
      throw new Error('Expected an array of opportunities');
    }

    const filteredOpportunities = opportunities.filter((opportunity) => opportunity.actual_close_date);
    const filteredOpportunitiesWithinTimeframe = filteredOpportunities.filter((opportunity) => {
      const closeDate = new Date(opportunity.actual_close_date);
      const timeframeDate = new Date(Date.now() - timeframe * 60 * 60 * 1000);
      return closeDate >= timeframeDate;
    });

    console.log('API Response:', JSON.stringify(filteredOpportunitiesWithinTimeframe, null, 2));
    return filteredOpportunitiesWithinTimeframe;
  } catch (error) {
    console.error('Error fetching opportunities:');
    throw error;
  }
};

const generate_report = async (event: any) => {
  try {
    // Validate inputs
    const devrevPAT = event.context.secrets['service_account_token'];
    const slackToken = event.input_data.keyrings['slack_oauth_token'];
    const llmApiKey = event.input_data.keyrings['llm_api_token'];
    const endpoint = event.execution_metadata.devrev_endpoint;

    // Initialize DevRev SDK
    const devrevSDK: ApiUtils = new ApiUtils(endpoint, devrevPAT);
    let commentID: string | undefined;
    const sourceId = event.payload['source_id'];

    // Get defaults from global values
    const defaultChannel = event.input_data.global_values.default_slack_channel;
    const defaultTimeframe = event.input_data.global_values.default_timeframe;

    // Parse input
    const commandParams = event.payload['parameters'];

    const parsedInput = parseInput(commandParams.trim() || '', {
      channel: defaultChannel,
      timeframe: defaultTimeframe,
    });
    const { channel, timeParams } = parsedInput;
    const timeframe = timeParams.totalHours;
    console.info('Timeframe:', timeframe, 'Channel:', channel);
    if (timeframe <= 0) {
      let postResp: HTTPResponse = await devrevSDK.postTextMessage(
        sourceId,
        'Please enter a valid timeframe',
        commentID
      );
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
      }
      commentID = postResp.data.timeline_entry.id;
      return;
    }

    // Get opportunities
    const opportunities = await getOpportunities(timeframe, devrevSDK);
    if (!opportunities || opportunities.length === 0) {
      const helpMessage = `There are no new closed-won opportunities in the given time frame!\n\n`;
      let postResp = await devrevSDK.postTextMessageWithVisibilityTimeout(sourceId, helpMessage, 1);
      if (!postResp.success) {
        throw new Error(`Error while creating timeline entry: ${postResp.message}`);
      }
      return;
    }

    let postResp: HTTPResponse = await devrevSDK.postTextMessageWithVisibilityTimeout(
      sourceId,
      'Generating summary...',
      1
    );
    if (!postResp.success) {
      console.error(`Error while creating timeline entry: ${postResp.message}`);
    }
    // Generate a summary of the opportunities
    const summary = await generateSummary(opportunities, llmApiKey);

    // Beautify the summary
    const beautifiedSummary = beautifySummary(summary);
    console.log(beautifiedSummary);

    // Initialize the Slack client
    const isChannelValid = await verifyChannel(channel, slackToken);
    if (!isChannelValid) {
      let postResp: HTTPResponse = await devrevSDK.postTextMessageWithVisibilityTimeout(
        sourceId,
        'The entered channel does not exist!',
        1
      );
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
      }
      return;
    }

    postResp = await devrevSDK.postTextMessageWithVisibilityTimeout(sourceId, `Generating PDF...`, 1);
    if (!postResp.success) {
      console.error(`Error while creating timeline entry: ${postResp.message}`);
    }

    // Create the PDF report
    const ownerCounts = getOpportunityOwnerCounts(opportunities);
    const chartImageBase64_1 = generateDoughnutChart(ownerCounts);
    const ownerByStageCounts = getOpportunityOwnerCountsByStage(opportunities);
    const chartImageBase64_2 = generateOpportunityStackedBarChart(ownerByStageCounts, ownerByStageCounts.globalCounts);
    const pdfBytes = await createPDFReport(beautifiedSummary, chartImageBase64_1, chartImageBase64_2);

    // Upload the generated PDF to Slack
    postResp = await devrevSDK.postTextMessageWithVisibilityTimeout(sourceId, `Connecting with Slack..`, 1);
    if (!postResp.success) {
      console.error(`Error while creating timeline entry: ${postResp.message}`);
    }

    const response = await uploadFileToSlack(pdfBytes, channel, slackToken);
    if (!response.ok) {
      postResp = await devrevSDK.postTextMessageWithVisibilityTimeout(sourceId, `${response.error}`, 1);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
      }
      return;
    }
    postResp = await devrevSDK.postTextMessageWithVisibilityTimeout(
      sourceId,
      `Summary posted successfully on Slack!`,
      1
    );
    if (!postResp.success) {
      console.error(`Error while creating timeline entry: ${postResp.message}`);
    }
  } catch (error) {
    console.error('Error processing the main function', error);
    throw error;
  }
};

export const run = async (events: any[]) => {
  for (const event of events) {
    await generate_report(event);
  }
};

export default run;
