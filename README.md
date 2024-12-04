# Opportunity Summarizer

## Overview

The DevRev **Opportunity Summarizer** Project is designed to generate summary reports of opportunities within a specified timeframe and post these summaries to a Slack channel. The project interacts with the DevRev API to fetch opportunities, uses an LLM to generate summaries, and utilizes the Slack API to post messages

## Features

- Automated reporting of closed-won opportunities using GPT-4o.
- Generates PDF reports with charts and analytics.
- Posts reports directly to Slack channels.
- Supports custom timeframes in days (`d`) and hours (`h`).
- Default settings: Slack channel (`general`) and timeframe (`7d`).
- Simple `/report` command for quick report generation.
- Integrates DevRev API, GPT-4o, and Slack API for seamless workflow.
- Provides a detailed timeline for each step in the process.

## Prerequisites

- DevRev Organization account
- Slack workspace and API token
- GPT-4o API token

## Installation

1. **Clone the Repository**

```bash
git clone https://github.com/Chaithra-S-Nayak/LadyBugs.git
cd LadyBugs/code
```

2.  **Install Dependencies**

```bash
  npm install
```

### Authenticate and Deploy the Snap-in

1. **Authenticate with DevRev**

```bash
devrev profiles authenticate -o <dev-org-slug> -u <your email@yourdomain.com>
```

2.  **Create a Snap-in Package**

```bash
 devrev snap_in_package create-one --slug my-first-snap-in | jq .
```

3.  **Create a Snap-in Version**

```bash
  devrev snap_in_version create-one --path .
```

4.  **Draft the Snap-in**

```bash
   devrev snap_in draft
```

## Configure and Install the Snap-In

1. **Access DevRev App**  
   Open the [DevRev App](https://app.devrev.ai) in your browser.

2. **Locate Your Snap-In**

   - Navigate to the Snap-Ins section in the app.
   - Your deployed Snap-In should be visible in the waiting for installation state.

3. **Enter Installation Configuration**  
   When prompted, provide the following values:
   - **SLACK-TOKEN**: Slack API token.
   - **LLM-TOKEN**: GPT-4o API token.
   - **Default Slack Channel Name**: A default channel name for notifications.
   - **Default Timeframe**: A default timeframe for your application.

## User Guidelines

1. **Navigate to the Discussions Tab**

   - Open the **Discussions** tab in the **Opportunity** section of the DevRev app.

2. **Enter the Command**

   - Use the `/report` command followed by the channel name and timeframe.
   - The timeframe should be in the format of Nd Nh , where N is a number, d stands for days, and h stands for hours.
   - Example: `/report sales 2d 3h` (for the last 2 days and 3 hours).

3. **Default Values**
   - If the channel name, timeframe, or both are not specified, the snap-in uses default values configured during installation:
     - **Default Slack Channel**: `general`
     - **Default Timeframe**: `7d` (7 days)

### Example Output

View a sample generated report [here](https://drive.google.com/file/d/1fiiPBIramUid_88iGrqw1SDFKFVyayur/view?usp=sharing).

## About the Team

This project was developed by **Team LadyBugs** from NMAM Institute of Technology, Nitte, Karkala.

**Team Members:**

- Bhavya Nayak (NNM22CS040) - [GitHub](https://github.com/BhavyaNayak04)
- Chaithra S Nayak (NNM22CC011) - [GitHub](https://github.com/Chaithra-S-Nayak)
- Rashmi N (NNM22AD043) - [GitHub](https://github.com/nrashmi06)
