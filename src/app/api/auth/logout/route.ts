import { NextResponse } from 'next/server';

const COOKIE_NAME = 'tenbucks-auth';

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete(COOKIE_NAME);
  return response;
}
