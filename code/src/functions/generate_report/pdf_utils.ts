import { createCanvas } from 'canvas';
import Chart, { ChartItem } from 'chart.js/auto';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Opportunity } from './index';
export const beautifySummary = (summary: string): string => {
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
// Function to get the count of opportunities by owner
export const getOpportunityOwnerCounts = (opportunities: Opportunity[]): { [owner: string]: number } => {
  const ownerCounts: { [owner: string]: number } = {};
  opportunities.forEach((opp) => {
    if (opp.stage?.name === 'closed_won') {
      const owner = opp.owned_by[0]?.full_name.trim().toLowerCase();
      if (owner) {
        ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
      }
    }
  });
  console.log('Owner closed_won counts:', ownerCounts);
  return ownerCounts;
};
export // Function to generate a doughnut chart from owner counts
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
export // Function to get opportunity owner counts by stage
const getOpportunityOwnerCountsByStage = (
  opportunities: Opportunity[]
): {
  [owner: string]: { closed_won_count: number; closed_lost_count: number };
  globalCounts: { closed_won_count: number; closed_lost_count: number };
} => {
  // Initialize the object to hold owner-wise counts and global counts
  const ownerStageCounts: {
    [owner: string]: { closed_won_count: number; closed_lost_count: number };
    globalCounts: { closed_won_count: number; closed_lost_count: number };
  } = {
    globalCounts: {
      closed_won_count: 0,
      closed_lost_count: 0,
    },
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
        ownerStageCounts.globalCounts.closed_won_count += 1;
      } else if (opp.stage?.name === 'closed_lost') {
        ownerStageCounts[owner].closed_lost_count += 1;
        ownerStageCounts.globalCounts.closed_lost_count += 1;
      }
    }
  });
  console.log('Owner counts:', ownerStageCounts);
  return ownerStageCounts;
};
// Function to generate a bar chart from owner counts
export const generateOpportunityStackedBarChart = (
  ownerCounts: { [owner: string]: { closed_won_count: number; closed_lost_count: number } },
  globalCounts: { closed_won_count: number; closed_lost_count: number }
): string => {
  const width = 400;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const owners = Object.keys(ownerCounts).filter(
    (owner) => owner !== 'closed_won_count' && owner !== 'closed_lost_count'
  );
  const wonCounts = owners.map((owner) => ownerCounts[owner]?.closed_won_count || 0);
  const lostCounts = owners.map((owner) => ownerCounts[owner]?.closed_lost_count || 0);
  const chartData = {
    labels: owners,
    datasets: [
      {
        label: 'Won Opportunities',
        data: wonCounts,
        backgroundColor: '#4caf50',
        stack: 'stack1',
      },
      {
        label: 'Lost Opportunities',
        data: lostCounts,
        backgroundColor: '#f44336',
        stack: 'stack1',
      },
    ],
  };
  new Chart(ctx as unknown as ChartItem, {
    type: 'bar',
    data: chartData,
  });
  return canvas.toDataURL();
};
export // Function to create a PDF report
const createPDFReport = async (
  beautifiedSummary: string,
  chartImageBase64_1: string,
  chartImageBase64_2: string
): Promise<Uint8Array> => {
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
  const base64Data_1 = chartImageBase64_1.replace(/^data:image\/png;base64,/, '');
  const base64Data_2 = chartImageBase64_2.replace(/^data:image\/png;base64,/, '');
  const doughnutChart_1 = await pdfDoc.embedPng(Buffer.from(base64Data_1, 'base64'));
  const barChart_1 = await pdfDoc.embedPng(Buffer.from(base64Data_2, 'base64'));
  if (yPosition - 200 < margin) {
    currentPage = createNewPage();
  }
  currentPage.drawImage(doughnutChart_1, {
    x: 75,
    y: yPosition - 200,
    width: 400,
    height: 200,
  });
  yPosition -= 200;
  if (yPosition - 200 < margin) {
    currentPage = createNewPage();
  }
  currentPage.drawImage(barChart_1, {
    x: 75,
    y: yPosition - 200,
    width: 400,
    height: 200,
  });
  return await pdfDoc.save();
};
