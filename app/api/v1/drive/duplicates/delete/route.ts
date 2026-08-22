import { NextRequest } from 'next/server';
import { POST as handleBurstDelete } from '@/app/api/v1/drive/burst-delete-duplicates/route';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleBurstDelete(req);
}
