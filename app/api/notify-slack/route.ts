import { NextRequest, NextResponse } from 'next/server';

interface VulnPayload {
  vulnerabilityId: string;
  instantId:       string;
  title:           string;
  description:     string;
  dateDiscovered:  string;
  source:          string;
  cveId?:          string;
  isZeroDay:       boolean;
  riskScore:       number;
  severity:        string;
}

const SEVERITY_EMOJI: Record<string, string> = {
  Critical: '🔴',
  High:     '🟠',
  Medium:   '🟡',
  Low:      '🔵',
};

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: 'SLACK_WEBHOOK_URL not configured' }, { status: 500 });
  }

  const body = (await req.json()) as VulnPayload;
  const {
    vulnerabilityId, instantId, title, description, dateDiscovered,
    source, cveId, isZeroDay, riskScore, severity,
  } = body;

  // Build deep link to the Impact Assessment page
  const appOrigin     = req.nextUrl.origin;
  const assessmentUrl = `${appOrigin}/impact-assessment/${instantId}`;

  const sevEmoji = SEVERITY_EMOJI[severity] ?? '⚪';
  const idLine   = isZeroDay
    ? `*${vulnerabilityId}*   🔴 Zero-Day`
    : `*${vulnerabilityId}*`;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🚨 New Vulnerability Logged', emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: idLine },
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Title*\n${title}` },
        { type: 'mrkdwn', text: `*CVE ID*\n${cveId || 'N/A'}` },
        { type: 'mrkdwn', text: `*Date Discovered*\n${dateDiscovered || 'N/A'}` },
        { type: 'mrkdwn', text: `*Source*\n${source || 'N/A'}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Description*\n${description || '_No description provided_'}`,
      },
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${sevEmoji} Severity: *${severity}*   ·   Risk Score: *${riskScore}*`,
        },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*👋 Action Required for Stakeholders*\nPlease log into Zero-Day Atlas and complete the *Impact Assessment* for your products — confirm whether your product is Impacted, Not-Impacted, or Unknown for this vulnerability.\n\n:point_right: <${assessmentUrl}|Open Impact Assessment for ${vulnerabilityId}>`,
      },
    },
  ];

  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ blocks }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: text }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
