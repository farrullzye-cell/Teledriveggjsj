import { NextRequest, NextResponse } from 'next/server';
import { POST as handleCheckDuplicate } from '@/app/api/v1/videos/check-duplicate/route';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleCheckDuplicate(req);
}
