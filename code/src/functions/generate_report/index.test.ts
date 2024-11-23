import { client } from '@devrev/typescript-sdk';
import { generate_report } from '.';
import { testRunner } from '../../test-runner/test-runner';

// Mocking the DevRev SDK and its methods
jest.mock('@devrev/typescript-sdk', () => ({
  client: {
    setup: jest.fn(),
  },
  publicSDK: {
    WorkType: {
      Ticket: 'ticket',
    },
  },
}));

describe('Index Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should test generate_report function with mocked data', async () => {
    const mockSetup = jest.fn();
    client.setup = mockSetup;

    const mockWorkList = jest.fn();
    mockSetup.mockReturnValue({
      worksList: mockWorkList,
    });

    mockWorkList.mockResolvedValue({
      data: {
        works: [
          {
            id: '123',
            name: 'Test Opportunity',
            revenue: 1000,
          },
        ],
      },
    });

    const event = {
      input_data: {
        timeframe: 24,
        configurations: {
          default_channel: '#general',
        },
      },
      context: {
        secrets: {
          service_account_token: 'TEST-PAT',
          slack_api_token: 'TEST-SLACK-TOKEN',
          llm_api_token: 'TEST-LLM-TOKEN',
        },
      },
      execution_metadata: {
        devrev_endpoint: 'https://devrev.com',
      },
    };

    const expectedResp = 'Summary generation failed.'; // Customize based on mock function behavior

    const response = await generate_report(event);
    expect(response).toEqual(expectedResp);
  });

  it('should run testRunner with proper fixture and function name', () => {
    testRunner({
      fixturePath: 'on_work_created_event.json',
      functionName: 'generate_report',
    });
  });
});
