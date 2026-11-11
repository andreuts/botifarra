import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { BugReportEnvironment, CreateBugReportRequest, CreateBugReportResponse } from '@botifarra/shared';

const REPORT_WINDOW_MS = 15 * 60 * 1000;
const REPORT_LIMIT = 3;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 5_000;
const MAX_REPRODUCTION_LENGTH = 3_000;
const MAX_OPTIONAL_FIELD_LENGTH = 2_000;
const GITHUB_ISSUES_URL = 'https://api.github.com/repos/andreuts/botifarra/issues';

const reportsByIp = new Map<string, number[]>();

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function isDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 20_000;
}

function isEnvironment(value: unknown): value is BugReportEnvironment {
  if (!value || typeof value !== 'object') return false;
  const environment = value as Partial<BugReportEnvironment>;
  return (
    isText(environment.appVersion, 80) &&
    isText(environment.route, 240) &&
    isText(environment.userAgent, 800) &&
    isText(environment.language, 80) &&
    isText(environment.timeZone, 120) &&
    typeof environment.viewport === 'object' && environment.viewport !== null &&
    isDimension(environment.viewport.width) && isDimension(environment.viewport.height) &&
    typeof environment.screen === 'object' && environment.screen !== null &&
    isDimension(environment.screen.width) && isDimension(environment.screen.height) &&
    typeof environment.pixelRatio === 'number' && Number.isFinite(environment.pixelRatio) &&
    environment.pixelRatio > 0 && environment.pixelRatio <= 10 &&
    typeof environment.online === 'boolean'
  );
}

function isValidReport(body: unknown): body is CreateBugReportRequest {
  if (!body || typeof body !== 'object') return false;
  const report = body as Partial<CreateBugReportRequest>;
  return (
    isText(report.title, MAX_TITLE_LENGTH) && report.title.trim().length > 0 &&
    isText(report.description, MAX_DESCRIPTION_LENGTH) && report.description.trim().length >= 10 &&
    isText(report.stepsToReproduce, MAX_REPRODUCTION_LENGTH) &&
    isText(report.expectedBehavior, MAX_OPTIONAL_FIELD_LENGTH) &&
    isText(report.actualBehavior, MAX_OPTIONAL_FIELD_LENGTH) &&
    isEnvironment(report.environment)
  );
}

function consumeRateLimit(ip: string, now = Date.now()): boolean {
  const recent = (reportsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < REPORT_WINDOW_MS);
  if (recent.length >= REPORT_LIMIT) {
    reportsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  reportsByIp.set(ip, recent);

  if (reportsByIp.size > 10_000) {
    for (const [key, timestamps] of reportsByIp) {
      if (!timestamps.some((timestamp) => now - timestamp < REPORT_WINDOW_MS)) reportsByIp.delete(key);
    }
  }
  return true;
}

function formatIssueBody(report: CreateBugReportRequest): string {
  const environment = report.environment;
  return [
    '## Description',
    report.description.trim(),
    '',
    '## Steps to reproduce',
    report.stepsToReproduce.trim() || '_Not provided._',
    '',
    '## Expected behavior',
    report.expectedBehavior.trim() || '_Not provided._',
    '',
    '## Actual behavior',
    report.actualBehavior.trim() || '_Not provided._',
    '',
    '## Environment',
    `- App version: ${environment.appVersion}`,
    `- Route: ${environment.route}`,
    `- Browser / user agent: ${environment.userAgent}`,
    `- Language: ${environment.language}`,
    `- Time zone: ${environment.timeZone}`,
    `- Viewport: ${environment.viewport.width} × ${environment.viewport.height}`,
    `- Screen: ${environment.screen.width} × ${environment.screen.height}`,
    `- Pixel ratio: ${environment.pixelRatio}`,
    `- Network: ${environment.online ? 'online' : 'offline'}`,
    '',
    '---',
    '_Submitted from the in-app beta bug reporter._',
  ].join('\n');
}

export const bugReportRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post<{ Body: CreateBugReportRequest }>(
    '/report',
    { bodyLimit: 32 * 1024 },
    async (request, reply) => {
      if (!isValidReport(request.body)) {
        return reply.status(400).send({ error: 'INVALID_BUG_REPORT' });
      }

      const token = process.env['GITHUB_TOKEN']?.trim();
      if (!token) {
        return reply.status(503).send({ error: 'BUG_REPORTING_UNAVAILABLE' });
      }

      if (!consumeRateLimit(request.ip)) {
        return reply.status(429).send({ error: 'BUG_REPORT_RATE_LIMITED' });
      }

      try {
        const response = await fetch(GITHUB_ISSUES_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Botifarra-Online-Beta-Bug-Reporter',
          },
          body: JSON.stringify({
            title: `[Beta bug] ${request.body.title.trim()}`,
            body: formatIssueBody(request.body),
          }),
        });

        if (!response.ok) {
          app.log.error({ statusCode: response.status }, 'GitHub rejected a beta bug report');
          return reply.status(502).send({ error: 'BUG_REPORT_SUBMISSION_FAILED' });
        }

        const issue = await response.json() as { number?: unknown; html_url?: unknown };
        if (typeof issue.number !== 'number' || typeof issue.html_url !== 'string') {
          app.log.error('GitHub returned an invalid issue response');
          return reply.status(502).send({ error: 'BUG_REPORT_SUBMISSION_FAILED' });
        }

        const result: CreateBugReportResponse = {
          issueNumber: issue.number,
          issueUrl: issue.html_url,
        };
        return reply.status(201).send(result);
      } catch (error) {
        app.log.error({ err: error }, 'Could not create a GitHub bug report');
        return reply.status(502).send({ error: 'BUG_REPORT_SUBMISSION_FAILED' });
      }
    },
  );
};
