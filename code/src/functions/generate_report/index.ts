// import { betaSDK, client } from '@devrev/typescript-sdk';
import { FunctionExecutionError } from '@devrev/typescript-sdk/dist/snap-ins/types';
import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// import prettier from 'prettier';

const axios = require('axios');

interface Opportunity {
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
  name: string;
  revenue: number;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TimeParams {
  days?: number;
  hours?: number;
  totalHours: number;
}

const parseTimeParameters = (timeString: string): TimeParams => {
  const daysMatch = timeString.match(/(\d+)d/);
  const hoursMatch = timeString.match(/(\d+)h/);

  const days = daysMatch ? parseInt(daysMatch[1]) : 0;
  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;

  // If neither days nor hours specified, throw error
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
      console.info('Channel exists:', channelExists, 'Channel lists:', result.channels);
      return channelExists;
    } else {
      throw new Error('Failed to fetch channels list');
    }
  } catch (error) {
    console.error('Error verifying channel:', error);
    throw error;
  }
};

const getOpportunities = async (timeframe: number, devrevPAT: string): Promise<any[]> => {
  try {
    // Fetch opportunities
    const endpoint = 'https://api.devrev.ai/works.list';
    const params = {
      limit: 100,
      type: 'opportunity',
      // actual_close_date: new Date(Date.now() - timeframe * 60 * 60 * 1000).toISOString(),
      // Commenting out filters for now
      // 'filters[opportunity.subtype]': 'closed-won', // Adjust this based on the correct filter parameter
      // 'filters[updated_at][after]': new Date(Date.now() - timeframe * 60 * 60 * 1000).toISOString()
    };

    const headers = {
      Authorization: `Bearer ${devrevPAT}`,
      Accept: 'application/json',
      'User-Agent': 'axios/1.7.7',
      'X-DevRev-Scope': 'beta',
    };

    const response = await axios.get(endpoint, { params, headers });
    const data = response.data;

    // Extract opportunities from the response
    const opportunities = data.works;

    // Ensure opportunities is an array
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
    console.info('This is the culprit');
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
      type: opp.type,
      actual_close_date: opp.actual_close_date,
      body: opp.body,
      created_by: {
        type: opp.created_by.type,
        display_id: opp.created_by.display_id,
        display_name: opp.created_by.display_name,
        email: opp.created_by.email,
        full_name: opp.created_by.full_name,
        id: opp.created_by.id,
        state: opp.created_by.state,
      },
      created_date: opp.created_date,
      custom_fields: opp.custom_fields,
      display_id: opp.display_id,
      modified_by: {
        type: opp.modified_by.type,
        display_id: opp.modified_by.display_id,
        display_name: opp.modified_by.display_name,
        email: opp.modified_by.email,
        full_name: opp.modified_by.full_name,
        id: opp.modified_by.id,
        state: opp.modified_by.state,
      },
      modified_date: opp.modified_date,
      owned_by: opp.owned_by,
      stage: {
        name: opp.stage.name,
        notes: opp.stage.notes,
        ordinal: opp.stage.ordinal,
        stage: opp.stage.stage,
        state: opp.stage.state,
      },
      stock_schema_fragment: opp.stock_schema_fragment,
      tags: opp.tags,
      title: opp.title,
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

Provide the output in a well-structured, brief format such that i can make a pdf out of it divide each subheading to sections intro Content and conclusion. Avoid raw data and focus on insights.`,
      },
    ];

    // Call OpenAI to generate the summary
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 1000,
    });
    // console.log('OpenAI Response:', response.choices[0]?.message?.content);
    return response.choices[0]?.message?.content || 'Summary generation failed.';
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
};

// Function to create a PDF report
const createPDFReport = async (beautifiedSummary: string): Promise<Uint8Array> => {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();

  // Split content into pages if needed
  const pageContent = beautifiedSummary.split('\n');
  const bodyFontSize = 12;
  const lineSpacing = 14;
  const margin = 50;
  const pageHeight = 800;
  const pageWidth = 600;
  const maxContentHeight = pageHeight - 100; // Adjust for header/footer
  let yPosition = maxContentHeight; // Start position for the content

  let currentPage: any = null;
  let pageNumber = 1;

  // Embed fonts
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Function to create a new page
  const createNewPage = () => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    yPosition = maxContentHeight; // Reset y-position
    addHeaderFooter(page, pageNumber, boldFont, regularFont);
    pageNumber += 1;
    return page;
  };

  // Add the first page
  currentPage = createNewPage();

  // Process and write content
  for (const line of pageContent) {
    if (yPosition - lineSpacing < margin) {
      currentPage = createNewPage(); // Create a new page if out of space
    }

    const isHeading = /^##/.test(line) || /^###/.test(line); // Detect subheadings
    const font = isHeading ? boldFont : regularFont;
    const wrappedLines = wrapText(line, font, pageWidth - 2 * margin, bodyFontSize);

    for (const wrappedLine of wrappedLines) {
      currentPage.drawText(wrappedLine, {
        x: margin,
        y: yPosition,
        font,
        size: bodyFontSize,
        color: rgb(0, 0, 0),
      });
      yPosition -= lineSpacing; // Move down for the next line
    }
  }

  // Save the PDF document to bytes
  return await pdfDoc.save();
};

// Function to add header and footer to a page
const addHeaderFooter = (page: any, pageNumber: number, boldFont: any, regularFont: any) => {
  const headerText = 'Business Opportunities Report';
  const footerText = `Page ${pageNumber}`;

  // Add header
  page.drawText(headerText, {
    x: 50,
    y: 780,
    font: boldFont,
    size: 14,
    color: rgb(0, 0, 0),
  });

  // Add footer
  const footerWidth = regularFont.widthOfTextAtSize(footerText, 10);
  const footerX = (page.getWidth() - footerWidth) / 2; // Center the footer
  page.drawText(footerText, {
    x: footerX,
    y: 20,
    font: regularFont,
    size: 10,
    color: rgb(0, 0, 0),
  });
};

// Helper function to wrap text within the max width
const wrapText = (text: string, font: any, maxWidth: number, fontSize: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testLineWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testLineWidth <= maxWidth) {
      currentLine = testLine; // Add word to the current line
    } else {
      if (currentLine) lines.push(currentLine); // Push the completed line
      currentLine = word; // Start a new line with the word
    }
  }

  if (currentLine) lines.push(currentLine); // Push the last line
  return lines;
};

// Function to beautify the summary (remove unnecessary markdown and make headings bold)
const beautifySummary = (summary: string): string => {
  const cleanedSummary = summary
    .replace(/(#+\s?)/g, '') // Remove Markdown headers (e.g., # Header)
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold (**text** becomes text)
    .replace(/\*(.*?)\*/g, '$1') // Remove italic (*text* becomes text)
    .replace(/__([^_]+)__/g, '$1') // Remove bold underscores (__text__ becomes text)
    .replace(/_(.*?)_/g, '$1') // Remove italic underscores (_text_ becomes text)
    .replace(/`([^`]+)`/g, '$1'); // Remove inline code (`text` becomes text)

  // Prettify the cleaned summary
  // return prettier.format(cleanedSummary, { parser: 'markdown' });
  return cleanedSummary;
};

async function uploadFileToSlack(pdfBytes: Uint8Array, channelName: string, slackClient: WebClient) {
  try {
    const channelId = await getChannelIdByName(channelName, slackClient);
    if (!channelId) {
      throw new Error(`Channel ID for ${channelName} not found.`);
    }
    await slackClient.conversations.join({ channel: channelId });
    const buffer = Buffer.from(pdfBytes); // Define the buffer variable
    const response = await slackClient.files.uploadV2({
      channels: channelId, // Ensure this is the channel ID
      file: buffer,
      filename: 'Business_Opportunities_Report.pdf',
      filetype: 'pdf',
      title: 'Business Opportunities Report',
    });
    console.log('File uploaded:', response);
  } catch (error: any) {
    // Type the error object
    console.error('Error uploading file:', error.response?.data || error.message);
    throw error;
  }
}

async function getChannelIdByName(channelName: string, slackClient: WebClient) {
  try {
    const response = await slackClient.conversations.list();
    if (response.ok) {
      // Find the channel by its name
      const channel = response.channels?.find((c) => c.name === channelName);
      if (channel) {
        return channel.id; // Return the channel ID
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

const generate_report = async (event: any) => {
  // Step 1: Validate inputs
  const devrevPAT: string = event.context.secrets.service_account_token;
  const slackToken = event.input_data.keyrings['slack_api_token'];
  const llmApiKey = event.input_data.keyrings['llm_api_token'];
  const endpoint = event.execution_metadata.devrev_endpoint;

  if (!slackToken || !llmApiKey) {
    throw new Error('Missing required secrets: service_account_token, slack_api_token, or llm_api_token.');
  }

  // Step 2: Initialize DevRev SDK
  // const devrevSDK = client.setup({
  //   endpoint: endpoint,
  //   token: devrevPAT,
  // });

  const slackClient = new WebClient(slackToken);

  // Validate command parameters
  const commandParams = event.payload['parameters'];
  if (!commandParams) {
    throw new Error('No parameters provided in the event payload.');
  }

  const parsedInput = parseInput(commandParams.trim());
  const { channel, timeParams, color } = parsedInput;
  const timeframe = timeParams.totalHours;

  console.info('Timeframe:', timeframe, 'Channel:', channel, 'Color:', color);
  if (timeframe <= 0) {
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

  try {
    // Generate summary (from previous code or API)
    const summary = await generateSummary(opportunities, llmApiKey);

    // Beautify the summary
    const beautifiedSummary = beautifySummary(summary);
    console.log(beautifiedSummary);

    // Create the PDF report
    const pdfBytes = await createPDFReport(beautifiedSummary);

    // Upload the generated PDF to Slack
    const slackResponse = await uploadFileToSlack(pdfBytes, channel, slackClient);
    console.log('Slack response:', slackResponse);
  } catch (error) {
    console.error('Error generating and uploading report:', error);
    console.info('Slack culprit');
    throw error;
  }
};

export const run = async (events: any[]) => {
  console.log('Events: ', JSON.stringify(events));
  try {
    for (const event of events) {
      await generate_report(event);
    }
    console.log('Retrying....');
    const runtimeError = new FunctionExecutionError('Runtime Retryable Error', true, false);
    throw runtimeError;
  } catch (error) {
    if (error instanceof FunctionExecutionError) {
      throw error;
    } else {
      console.error('Error:', error);
      throw new FunctionExecutionError('Runtime Non-Retryable Error', false, false);
    }
  }
};

export default run;
