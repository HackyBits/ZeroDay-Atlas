import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// Generated once when this module is first loaded (i.e., on server start).
// A server restart loads a fresh module, producing a new ID.
const BOOT_ID = randomUUID();

export function GET() {
  return NextResponse.json({ bootId: BOOT_ID });
}
