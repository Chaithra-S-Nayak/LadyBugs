import OpenAI from 'openai';
import { Opportunity } from './index';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const generateSummary = async (
  opportunities: Opportunity[],
  timeframe: number,
  llmApiKey: string
): Promise<string> => {
  try {
    const openai = new OpenAI({
      apiKey: llmApiKey,
    });

    // Fomat the time
    const timeframeString = timeframe >= 24 ? `${Math.floor(timeframe / 24)} days` : `${timeframe} hours`;

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
        content: `This report summarizes the closed-won opportunities in the last ${timeframeString}.
        \n\nOpportunities:\n${JSON.stringify(opportunityDetails, null, 2)}
        \n\nPlease extract the following information from each opportunity which can be present in the body:
Account name
Revenue from the opportunity
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
