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

const ALLOWED_SEVERITIES = new Set(['Critical', 'High', 'Medium', 'Low']);

// ── Rate limiter ──────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX       = 10;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

// ── Input validator ───────────────────────────────────────────────────────────
function validatePayload(body: unknown): { valid: true; data: VulnPayload } | { valid: false; reason: string } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, reason: 'Request body must be a JSON object' };
  }

  const b = body as Record<string, unknown>;

  const requiredStrings: (keyof VulnPayload)[] = [
    'vulnerabilityId', 'instantId', 'title', 'description', 'dateDiscovered', 'source', 'severity',
  ];
  for (const field of requiredStrings) {
    if (typeof b[field] !== 'string' || !(b[field] as string).trim()) {
      return { valid: false, reason: `Missing or invalid field: ${field}` };
    }
  }

  if ((b.title as string).length > 200) {
    return { valid: false, reason: 'title exceeds maximum length of 200 characters' };
  }
  if ((b.description as string).length > 2000) {
    return { valid: false, reason: 'description exceeds maximum length of 2000 characters' };
  }
  if (!ALLOWED_SEVERITIES.has(b.severity as string)) {
    return { valid: false, reason: 'severity must be one of: Critical, High, Medium, Low' };
  }
  if (typeof b.isZeroDay !== 'boolean') {
    return { valid: false, reason: 'isZeroDay must be a boolean' };
  }
  if (typeof b.riskScore !== 'number' || b.riskScore < 0 || b.riskScore > 100) {
    return { valid: false, reason: 'riskScore must be a number between 0 and 100' };
  }
  if (b.cveId !== undefined && (typeof b.cveId !== 'string' || (b.cveId as string).length > 50)) {
    return { valid: false, reason: 'cveId must be a string of at most 50 characters' };
  }

  return {
    valid: true,
    data: {
      vulnerabilityId: (b.vulnerabilityId as string).trim(),
      instantId:       (b.instantId as string).trim(),
      title:           (b.title as string).trim(),
      description:     (b.description as string).trim(),
      dateDiscovered:  (b.dateDiscovered as string).trim(),
      source:          (b.source as string).trim(),
      severity:        b.severity as string,
      isZeroDay:       b.isZeroDay as boolean,
      riskScore:       b.riskScore as number,
      cveId:           typeof b.cveId === 'string' ? (b.cveId as string).trim() : undefined,
    },
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[notify-slack] SLACK_WEBHOOK_URL is not configured');
    return NextResponse.json({ ok: false, error: 'Notification service not configured' }, { status: 500 });
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  // Parse & validate
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validatePayload(rawBody);
  if (!validation.valid) {
    console.warn('[notify-slack] Validation failed:', validation.reason);
    return NextResponse.json({ ok: false, error: 'Invalid request payload' }, { status: 400 });
  }

  const {
    vulnerabilityId, instantId, title, description, dateDiscovered,
    source, cveId, isZeroDay, riskScore, severity,
  } = validation.data;

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

  // Send to Slack with a 10-second timeout
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ blocks }),
      signal:  controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[notify-slack] Slack webhook error:', res.status, text);
      return NextResponse.json({ ok: false, error: 'Notification service error' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[notify-slack] Slack webhook request timed out');
      return NextResponse.json({ ok: false, error: 'Notification service timed out' }, { status: 504 });
    }
    console.error('[notify-slack] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Unexpected error' }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
