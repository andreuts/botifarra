export interface BugReportEnvironment {
  appVersion: string;
  route: string;
  userAgent: string;
  language: string;
  timeZone: string;
  viewport: { width: number; height: number };
  screen: { width: number; height: number };
  pixelRatio: number;
  online: boolean;
}

export interface CreateBugReportRequest {
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  environment: BugReportEnvironment;
}

export interface CreateBugReportResponse {
  issueNumber: number;
  issueUrl: string;
}
