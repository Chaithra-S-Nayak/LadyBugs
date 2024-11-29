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
  input: string
): {
  channel: string;
  timeParams: TimeParams;
  color: string;
} => {
  const parts = input.trim().split(' ');

  if (parts.length < 3 || parts.length > 4) {
    throw new Error('Invalid input format');
  }

  const channel = parts[0];
  const color = parts[parts.length - 1];
  const timeString = parts.slice(1, -1).join('');
  const timeParams = parseTimeParameters(timeString);

  return {
    channel,
    timeParams,
    color,
  };
};

// Fetch opportunities from DevRev API
const getOpportunities = async (timeframe: number, devrevSDK: any) => {
  try {
    const opp = await devrevSDK.worksList({
      limit: 100,
      type: [betaSDK.WorkType.Opportunity],
    });

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
    const devrevSDK = client.setupBeta({
      endpoint: endpoint,
      token: devrevPAT,
    });

    // Parse input
    const commandParams = event.payload['parameters'];
    if (!commandParams) {
      throw new Error('No parameters provided in the event payload.');
    }
    const parsedInput = parseInput(commandParams.trim());
    const { channel, timeParams, color } = parsedInput;
    const timeframe = timeParams.totalHours;
    console.log('Timeframe:', timeframe, 'Channel:', channel, 'Color:', color);

    if (timeframe <= 0) {
      throw new Error('Invalid timeframe provided.');
    }

    // Get opportunities
    const opportunities = await getOpportunities(timeframe, devrevSDK);
    if (!opportunities || opportunities.length === 0) {
      throw new Error(`No opportunities found in the last ${timeframe} hours.`);
    }

    // Generate a summary of the opportunities
    const summary = await generateSummary(opportunities, llmApiKey);

    // Beautify the summary
    const beautifiedSummary = beautifySummary(summary);
    console.log(beautifiedSummary);

    // Initialize the Slack client
    const isChannelValid = await verifyChannel(channel, slackToken);
    if (!isChannelValid) {
      throw new Error(`The channel ${channel} does not exist or is not accessible.`);
    }

    // Create the PDF report
    const ownerCounts = getOpportunityOwnerCounts(opportunities);
    const chartImageBase64_1 = generateDoughnutChart(ownerCounts);
    const ownerByStageCounts = getOpportunityOwnerCountsByStage(opportunities);
    const chartImageBase64_2 = generateOpportunityStackedBarChart(ownerByStageCounts, ownerByStageCounts.globalCounts);
    const pdfBytes = await createPDFReport(beautifiedSummary, chartImageBase64_1, chartImageBase64_2);

    // Upload the generated PDF to Slack
    const slackResponse = await uploadFileToSlack(pdfBytes, channel, slackToken);
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
