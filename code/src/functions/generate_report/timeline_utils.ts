import { betaSDK, client } from '@devrev/typescript-sdk';
import { AxiosResponse } from 'axios';

export type HTTPResponse = {
  success: boolean;
  message: string;
  data: any;
};

export const defaultResponse: HTTPResponse = {
  data: {},
  message: '',
  success: false,
};

export class ApiUtils {
  public devrevSdk!: betaSDK.Api<HTTPResponse>;

  // Constructor to initialize SDK instances
  constructor(endpoint: string, token: string) {
    this.devrevSdk = client.setupBeta({
      endpoint: endpoint,
      token: token,
    });
  }

  // Create a timeline entry
  async createTimeLine(payload: betaSDK.TimelineEntriesCreateRequest): Promise<HTTPResponse> {
    try {
      const response: AxiosResponse = await this.devrevSdk.timelineEntriesCreate(payload);
      return { data: response.data, message: 'Timeline created successfully', success: true };
    } catch (error: any) {
      if (error.response) {
        const err = `Failed to create timeline. Err: ${JSON.stringify(error.response.data)}, Status: ${
          error.response.status
        }`;
        return { ...defaultResponse, message: err };
      } else {
        return { ...defaultResponse, message: error.message };
      }
    }
  }

  // Update a timeline entry
  async updateTimeLine(payload: betaSDK.TimelineEntriesUpdateRequest): Promise<HTTPResponse> {
    try {
      const response: AxiosResponse = await this.devrevSdk.timelineEntriesUpdate(payload);
      return { data: response.data, message: 'Timeline updated successfully', success: true };
    } catch (error: any) {
      if (error.response) {
        const err = `Failed to update timeline. Err: ${JSON.stringify(error.response.data)}, Status: ${
          error.response.status
        }`;
        return { ...defaultResponse, message: err };
      } else {
        return { ...defaultResponse, message: error.message };
      }
    }
  }

  async postTextMessage(snapInId: string, message: string, commentID?: string) {
    if (!commentID) {
      // Create a new comment.
      const createPayload: betaSDK.TimelineEntriesCreateRequest = {
        body: message,
        body_type: betaSDK.TimelineCommentBodyType.Text,
        object: snapInId,
        type: betaSDK.TimelineEntriesCreateRequestType.TimelineComment,
        visibility: betaSDK.TimelineEntryVisibility.Internal,
      };

      const createTimelineResponse: HTTPResponse = await this.createTimeLine(createPayload);
      return createTimelineResponse;
    }
    // Update it instead.
    const updatePayload: betaSDK.TimelineEntriesUpdateRequest = {
      body: message,
      id: commentID,
      type: betaSDK.TimelineEntriesUpdateRequestType.TimelineComment,
    };
    const updateTimelineResponse: HTTPResponse = await this.updateTimeLine(updatePayload);
    return updateTimelineResponse;
  }

  async postTextMessageWithVisibilityTimeout(snapInId: string, message: string, expiresInMins: number) {
    // Create a new comment.
    const createPayload: betaSDK.TimelineEntriesCreateRequest = {
      expires_at: new Date(Date.now() + expiresInMins * 60000).toISOString(),
      body: message,
      body_type: betaSDK.TimelineCommentBodyType.Text,
      object: snapInId,
      type: betaSDK.TimelineEntriesCreateRequestType.TimelineComment,
      visibility: betaSDK.TimelineEntryVisibility.Internal,
    };

    const createTimelineResponse: HTTPResponse = await this.createTimeLine(createPayload);
    return createTimelineResponse;
  }

  async fetchOpportunities() {
    try {
      const response: AxiosResponse = await this.devrevSdk.worksList({
        limit: 100,
        type: [betaSDK.WorkType.Opportunity],
      });
      return response;
    } catch (error: any) {
      if (error.response) {
        const err = `Failed to fetch. Err: ${JSON.stringify(error.response.data)}, Status: ${error.response.status}`;
        return { ...defaultResponse, message: err };
      } else {
        return { ...defaultResponse, message: error.message };
      }
    }
  }
}
