/** Local developer utility. Uses Node built-ins; NO Node modules are used in Worker code. */
import { createHmac, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const repo = process.env.GITHUB_REPO;
const issueNumber = Number(process.env.ISSUE_NUMBER || 142);
const secret = process.env.GITHUB_WEBHOOK_SECRET;
if (!repo || !/^[^/]+\/[^/]+$/.test(repo) || !secret || !Number.isSafeInteger(issueNumber) || issueNumber < 1) {
  console.error('Set GITHUB_REPO=owner/repo, ISSUE_NUMBER=<existing issue>, GITHUB_WEBHOOK_SECRET=<same as Worker>');
  process.exit(1);
}
const payload = JSON.parse(await readFile(new URL('../sample-issue-opened.json', import.meta.url), 'utf8'));
const [owner, name] = repo.split('/');
payload.repository.name = name;
payload.repository.full_name = repo;
payload.repository.owner.login = owner;
payload.issue.number = issueNumber;
payload.issue.html_url = `https://github.com/${repo}/issues/${issueNumber}`;
const body = JSON.stringify(payload);
const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
const delivery = randomUUID();
await mkdir('.tmp', { recursive: true });
await writeFile('.tmp/webhook.json', body);
await writeFile('.tmp/signature.txt', signature);
await writeFile('.tmp/delivery-id.txt', delivery);
console.log('Fixture prepared in .tmp/. Run the curl command from README. Delivery:', delivery);
