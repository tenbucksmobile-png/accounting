import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'tenbucks-auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function computeToken(): string {
  return crypto
    .createHmac('sha256', process.env.COOKIE_SECRET ?? '')
    .update(process.env.SITE_PASSWORD ?? '')
    .digest('hex');
}

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!password || password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, computeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}
