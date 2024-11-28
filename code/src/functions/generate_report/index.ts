import { betaSDK, client } from '@devrev/typescript-sdk';
import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createCanvas } from 'canvas'; 
import Chart, { ChartItem } from 'chart.js/auto'; 

interface TimeParams {
  days?: number;
  hours?: number;
  totalHours: number;
}

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
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

Please extract the following information from each opportunity which can be present in the body:
Account name
Revenue from the opportunity
Number of employees
Opportunity owners (sales reps)
Key insights such as trends, upsell potential, and noteworthy outliers

Then, summarize the following:
The total number of closed-won opportunities.
Revenue breakdown of individual closed-won opportunity.
The top-performing accounts.
The top-performing sales reps.
A detailed summary of each opportunity, including name, revenue, account details, upsell potential and conclude with noteworthy outliers.
Provide the output in a well-structured, detailed format. Avoid raw data and focus on insights.`,
      },
    ];

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

const verifyChannel = async (channelName: string, slackClient: WebClient): Promise<boolean> => {
  try {
    let result;
    try {
      result = await slackClient.conversations.list();
    } catch (error) {
      console.error('Error fetching channels list:', error);
      throw error;
    }

    if (result.ok && result.channels) {
      const channelExists = result.channels.some((channel) => channel.name === channelName);
      // console.info('Channel exists:', channelExists, 'Channel lists:', result.channels);
      return channelExists;
    } else {
      throw new Error('Failed to fetch channels list');
    }
  } catch (error) {
    console.error('Error verifying channel:', error);
    throw error;
  }
};

// Function to get opportunity owner counts by stage
const getOpportunityOwnerCountsByStage = (opportunities: Opportunity[]): { [owner: string]: { closed_won_count: number, closed_lost_count: number }, globalCounts: { closed_won_count: number, closed_lost_count: number } } => {
  // Initialize the object to hold owner-wise counts and global counts
  const ownerStageCounts: { [owner: string]: { closed_won_count: number, closed_lost_count: number }, globalCounts: { closed_won_count: number, closed_lost_count: number } } = {
    globalCounts: {
      closed_won_count: 0,
      closed_lost_count: 0
    }
  };

  opportunities.forEach((opp) => {
    const owner = opp.owned_by[0]?.full_name.trim().toLowerCase();
    if (owner) {
      // Initialize owner data if it doesn't exist
      if (!ownerStageCounts[owner]) {
        ownerStageCounts[owner] = { closed_won_count: 0, closed_lost_count: 0 };
      }

      // Update the counts based on the opportunity stage
      if (opp.stage?.name === 'closed_won') {
        ownerStageCounts[owner].closed_won_count += 1;
        ownerStageCounts.globalCounts.closed_won_count += 1; // Increment global closed_won_count
      } else if (opp.stage?.name === 'closed_lost') {
        ownerStageCounts[owner].closed_lost_count += 1;
        ownerStageCounts.globalCounts.closed_lost_count += 1; // Increment global closed_lost_count
      }
    }
  });

  console.log('Owner counts:', ownerStageCounts);

  return ownerStageCounts;
};

// Function to generate a doughnut chart from owner counts
const generateOpportunityStackedBarChart = (ownerCounts: { [owner: string]: { closed_won_count: number, closed_lost_count: number } }, globalCounts: { closed_won_count: number, closed_lost_count: number }): string => {
  const width = 400;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Extract owner names (excluding the special counts for closed_won_count and closed_lost_count)
  const owners = Object.keys(ownerCounts).filter(owner => owner !== 'closed_won_count' && owner !== 'closed_lost_count');

  // Get the won and lost counts for each owner
  const wonCounts = owners.map(owner => ownerCounts[owner]?.closed_won_count || 0);
  const lostCounts = owners.map(owner => ownerCounts[owner]?.closed_lost_count || 0);

  // Chart Data - Stacked Bar Chart
  const chartData = {
    labels: owners, // Owner names on the x-axis
    datasets: [
      {
        label: 'Won Opportunities',
        data: wonCounts, // Won opportunities for each owner
        backgroundColor: '#4caf50', // Green for "Won"
        stack: 'stack1',
      },
      {
        label: 'Lost Opportunities',
        data: lostCounts, // Lost opportunities for each owner
        backgroundColor: '#f44336', // Red for "Lost"
        stack: 'stack1',
      },
    ],
  };

  // Chart Options - Configure the bar chart to be stacked
  const options = {
    responsive: true,
    scales: {
      x: {
        beginAtZero: true,
      },
      y: {
        beginAtZero: true,
        stacked: true, // Stack the bars on top of each other
      },
    },
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };

  // Generate the bar chart using Chart.js
  new Chart(ctx as unknown as ChartItem, {
    type: 'bar', // Stacked Bar Chart
    data: chartData,
  });

  return canvas.toDataURL(); // Return the chart as a base64-encoded string
};

// Function to get the count of opportunities by owner
const getOpportunityOwnerCounts = (opportunities: Opportunity[]): { [owner: string]: number } => {
  const ownerCounts: { [owner: string]: number } = {};

  opportunities.forEach((opp) => {
    if (opp.stage?.name === 'closed_won') {
      const owner = opp.owned_by[0]?.full_name.trim().toLowerCase();
      if (owner) {
        // Increment the count for the owner
        ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
      }
    }
  });

  console.log('Owner closed_won counts:', ownerCounts);

  return ownerCounts;
};



// Function to generate a doughnut chart from owner counts
  const generateDoughnutChart = (ownerCounts: { [owner: string]: number }): string => {
    const width = 400;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
  
    const data = {
      labels: Object.keys(ownerCounts),
      datasets: [
        {
          data: Object.values(ownerCounts),
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#FF5733', '#C70039'],
        },
      ],
    };
  
    new Chart(ctx as unknown as ChartItem, {
      type: 'doughnut',
      data,
    });
  
    return canvas.toDataURL();
  };

// Function to create a PDF report
const createPDFReport = async (beautifiedSummary: string , chartImageBase64_1: string , chartImageBase64_2 : string ): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const pageContent = beautifiedSummary.split('\n');
  const bodyFontSize = 12;
  const lineSpacing = 14;
  const margin = 50;
  const pageHeight = 800;
  const pageWidth = 600;
  const maxContentHeight = pageHeight - 100;
  let yPosition = maxContentHeight;
  let currentPage: any = null;
  let pageNumber = 1;

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const addHeaderFooter = (page: any, pageNumber: number, boldFont: any, regularFont: any) => {
    const headerText = 'Business Opportunities Report';
    const footerText = `Page ${pageNumber}`;

    page.drawText(headerText, {
      x: 50,
      y: 780,
      font: boldFont,
      size: 14,
      color: rgb(0, 0, 0),
    });

    const footerWidth = regularFont.widthOfTextAtSize(footerText, 10);
    const footerX = (page.getWidth() - footerWidth) / 2;
    page.drawText(footerText, {
      x: footerX,
      y: 20,
      font: regularFont,
      size: 10,
      color: rgb(0, 0, 0),
    });
  };

  const wrapText = (text: string, font: any, maxWidth: number, fontSize: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testLineWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testLineWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const createNewPage = () => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    yPosition = maxContentHeight;
    addHeaderFooter(page, pageNumber, boldFont, regularFont);
    pageNumber += 1;
    return page;
  };

  currentPage = createNewPage();

  for (const line of pageContent) {
    if (line.trim() === '') {
      yPosition -= lineSpacing * 0.5;
      continue;
    }

    if (yPosition - lineSpacing < margin) {
      currentPage = createNewPage();
    }

    const isHeading = /^##/.test(line) || /^###/.test(line);
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
      yPosition -= lineSpacing;
    }
  }
  // Remove the base64 prefix and embed the chart image
const base64Data_1 = chartImageBase64_1.replace(/^data:image\/png;base64,/, '');
const base64Data_2 = chartImageBase64_2.replace(/^data:image\/png;base64,/, '');
const doughnutChart_1 = await pdfDoc.embedPng(Buffer.from(base64Data_1, 'base64'));
const barChart_1 = await pdfDoc.embedPng(Buffer.from(base64Data_2, 'base64'));

// Check if the current page has enough space left for the chart 1
if (yPosition - 300 < margin) {
  currentPage = createNewPage();
}

// Add the chart image at the end for chart 1
currentPage.drawImage(doughnutChart_1, {
  x: 75,
  y: yPosition - 300, // Adjust position based on remaining space
  width: 400,
  height: 300,
});

// Update the yPosition after placing the first chart
yPosition -= 300; // Adjust yPosition to make space for the second chart

// Ensure there is enough space for the second chart
if (yPosition - 300 < margin) {
  currentPage = createNewPage();
}

// Add the chart image at the end for chart 2
currentPage.drawImage(barChart_1, {
  x: 75,
  y: yPosition - 300, // Adjust position based on remaining space
  width: 400,
  height: 300,
});
  return await pdfDoc.save();
};



const beautifySummary = (summary: string): string => {
  const cleanedSummary = summary
    .replace(/(#+\s?)/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/-\s+/g, '')
    .replace(/\n{2,}/g, '\n\n')
    .trim();

  return cleanedSummary;
};

async function getChannelIdByName(channelName: string, slackClient: WebClient) {
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

async function uploadFileToSlack(pdfBytes: Uint8Array, channelName: string, slackClient: WebClient) {
  try {
    const channelId = await getChannelIdByName(channelName, slackClient);
    if (!channelId) {
      throw new Error(`Channel ID for ${channelName} not found.`);
    }
    await slackClient.conversations.join({ channel: channelId });
    const buffer = Buffer.from(pdfBytes);
    const response = await slackClient.files.uploadV2({
      channel_id: channelId,
      channel_id: channelId,
      file: buffer,
      filename: 'Business_Opportunities_Report.pdf',
      title: 'Business Opportunities Report',
    });
    // console.log('File uploaded:', response);
  } catch (error: any) {
    console.error('Error uploading file:', error.response?.data || error.message);
    throw error;
  }
}

const generate_report = async (event: any) => {
  // Validate inputs
  const devrevPAT = event.context.secrets['service_account_token'];
  const slackToken = event.context.secrets['slack_api_token'];
  const llmApiKey = event.context.secrets['llm_api_token'];
  const endpoint = event.execution_metadata.devrev_endpoint;
  if (!slackToken || !llmApiKey) {
    throw new Error('Missing required secrets: slack_api_token, or llm_api_token.');
  }

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
  console.info('Timeframe:', timeframe, 'Channel:', channel, 'Color:', color);
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
  const slackClient = new WebClient(slackToken);
  const isChannelValid = await verifyChannel(channel, slackClient);
  if (!isChannelValid) {
    throw new Error(`The channel ${channel} does not exist or is not accessible.`);
  }

  // Create the PDF report
  const ownerCounts = getOpportunityOwnerCounts(opportunities);
  const chartImageBase64_1 = generateDoughnutChart(ownerCounts);
  const ownerByStageCounts = getOpportunityOwnerCountsByStage(opportunities);
  const chartImageBase64_2 = generateOpportunityStackedBarChart(ownerByStageCounts , ownerByStageCounts.globalCounts);
  const pdfBytes = await createPDFReport(beautifiedSummary, chartImageBase64_1, chartImageBase64_2);


  // Upload the generated PDF to Slack
  const slackResponse = await uploadFileToSlack(pdfBytes, channel, slackClient);
  // console.log('Slack response:', slackResponse);
};

export const run = async (events: any[]) => {
  console.log('Events: ', JSON.stringify(events));
  for (const event of events) {
    await generate_report(event);
  }
};

export default run;
