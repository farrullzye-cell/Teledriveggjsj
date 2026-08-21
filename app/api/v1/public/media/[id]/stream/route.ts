import { NextRequest } from 'next/server';
import { GET as handleStream } from '@/app/api/v1/videos/stream/[id]/route';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleStream(req, context);
}
