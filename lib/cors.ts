import { NextResponse } from 'next/server';

export function getCorsHeaders(origin: string = '*') {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Public-Client, Accept',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCorsOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export function jsonWithCors(data: any, status: number = 200, extraHeaders: Record<string, string> = {}) {
  const headers = {
    ...getCorsHeaders(),
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  return NextResponse.json(data, { status, headers });
}
