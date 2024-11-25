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
          service_account_token:
            'eyJhbGciOiJSUzI1NiIsImlzcyI6Imh0dHBzOi8vYXV0aC10b2tlbi5kZXZyZXYuYWkvIiwia2lkIjoic3RzX2tpZF9yc2EiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOlsiamFudXMiXSwiYXpwIjoiZG9uOmlkZW50aXR5OmR2cnYtaW4tMTpkZXZvLzJHSWxVbGo3RkY6ZGV2dS8xIiwiZXhwIjoxODI3MDQwNjA1LCJodHRwOi8vZGV2cmV2LmFpL2F1dGgwX3VpZCI6ImRvbjppZGVudGl0eTpkdnJ2LXVzLTE6ZGV2by9zdXBlcjphdXRoMF91c2VyL2dvb2dsZS1vYXV0aDJ8MTA4MzM3ODA4MTUxMjAxODY3MjY4IiwiaHR0cDovL2RldnJldi5haS9hdXRoMF91c2VyX2lkIjoiZ29vZ2xlLW9hdXRoMnwxMDgzMzc4MDgxNTEyMDE4NjcyNjgiLCJodHRwOi8vZGV2cmV2LmFpL2Rldm9fZG9uIjoiZG9uOmlkZW50aXR5OmR2cnYtaW4tMTpkZXZvLzJHSWxVbGo3RkYiLCJodHRwOi8vZGV2cmV2LmFpL2Rldm9pZCI6IkRFVi0yR0lsVWxqN0ZGIiwiaHR0cDovL2RldnJldi5haS9kZXZ1aWQiOiJERVZVLTEiLCJodHRwOi8vZGV2cmV2LmFpL2Rpc3BsYXluYW1lIjoibm5tMjJjczA0MCIsImh0dHA6Ly9kZXZyZXYuYWkvZW1haWwiOiJubm0yMmNzMDQwQG5tYW1pdC5pbiIsImh0dHA6Ly9kZXZyZXYuYWkvZnVsbG5hbWUiOiJOTk0yMkNTMDQwIEJIQVZZQSBOQVlBSyIsImh0dHA6Ly9kZXZyZXYuYWkvaXNfdmVyaWZpZWQiOnRydWUsImh0dHA6Ly9kZXZyZXYuYWkvdG9rZW50eXBlIjoidXJuOmRldnJldjpwYXJhbXM6b2F1dGg6dG9rZW4tdHlwZTpwYXQiLCJpYXQiOjE3MzI0MzI2MDUsImlzcyI6Imh0dHBzOi8vYXV0aC10b2tlbi5kZXZyZXYuYWkvIiwianRpIjoiZG9uOmlkZW50aXR5OmR2cnYtaW4tMTpkZXZvLzJHSWxVbGo3RkY6dG9rZW4vMUYwb281b3FKIiwib3JnX2lkIjoib3JnX0t0U3F1elNtd3AwVnluaUgiLCJzdWIiOiJkb246aWRlbnRpdHk6ZHZydi1pbi0xOmRldm8vMkdJbFVsajdGRjpkZXZ1LzEifQ.FbW6rDZnMFGRSoUVjtL6uOoIOml5yyi1PbK8dK6PgIF5P4u1m4rJMRep1ar8NrcUZka7iAYLVJ6TviN-TqQW-_XrOmu8UkfaX9CKvGqft8ce_S8JAfxfzullSLvu6WDHbDau1SJYfu4B2E7l4ZsQDnUrfwaLnS9Cq9JpUeHDGtWWilamfHCo0JRC8liWkCzuG4Eu1E0fD2qDA0i6iB3ahTGomGqMgJl_IYG5uLEaybcUCXmbJBxHz7YGFp6CHCXZTnhmyFcXE31eGPJMgTFhsXApZYmT2G2PxXc7clJfdzexEHdxM8vI_xDfMk3sXwK1q8IHv0YXqrrqVoJKmAg5bQ-PAT',
          slack_api_token: 'xoxb-8048147099172-8076857997332-ZMwxFWgMqHjzMYu1IxuRsT3C',
          llm_api_token:
            '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',
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
