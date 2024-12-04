import { betaSDK, client } from '@devrev/typescript-sdk';
import { testRunner } from '../../test-runner/test-runner';
import generate_report from '../generate_report';

// Mocking the DevRev SDK and its methods
jest.mock('@devrev/typescript-sdk', () => ({
  client: {
    setup: jest.fn(),
  },
  betaSDK: {
    WorkType: {
      Opportunity: 'opportunity',
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
          default_channel: 'general',
        },
      },
      context: {
        secrets: {
          service_account_token: 'SERVICE_ACCOUNT_TOKEN',
          slack_api_token: 'SLACK_API_TOKEN',
          llm_api_token:'LLM_API_TOKEN',
        },
      },
      execution_metadata: {
        devrev_endpoint: 'https://devrev.com',
      },
    };

    const expectedResp = 'Summary generation failed.'; // Customize based on mock function behavior

    const response = await generate_report([event]);
    expect(response).toEqual(expectedResp);
  });

  it('should run testRunner with proper fixture and function name', () => {
    testRunner({
      fixturePath: 'generate_report.json',
      functionName: 'generate_report',
    });
  });
});

// import { testRunner } from '../../test-runner/test-runner';

// describe('Example Index Test file', () => {
//   it('Testing the method', () => {
//     testRunner({
//       fixturePath: 'on_command.json',
//       functionName: 'generate_report',
//     });
//   });
// });
