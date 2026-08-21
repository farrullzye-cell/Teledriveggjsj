import { NextRequest, NextResponse } from 'next/server';
import { checkDuplicateBatch, getFiles } from '@/lib/excel-db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/videos/check-duplicate
 * Fast Duplicate Detection Engine
 * Matches by gdrive_file_id, telegram_file_id, imagekit_file_id, or name + size
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      // Single item check
      const { name, size, gdrive_file_id, telegram_file_id } = body;
      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'INVALID_PARAM', message: 'Field "name" atau array "items" wajib disertakan.' },
          },
          { status: 400 }
        );
      }

      const results = await checkDuplicateBatch([{ name, size, gdrive_file_id, telegram_file_id }]);
      const isDuplicate = results[0].isDuplicate;
      const matched = results[0].matchedFile;

      return NextResponse.json({
        success: true,
        isDuplicate,
        matchedFile: matched
          ? {
              id: matched.id,
              name: matched.name,
              size: matched.size,
              vault_name: matched.vault_name,
              uploaded_at: matched.uploaded_at,
              gdrive_url: matched.gdrive_url,
            }
          : null,
        message: isDuplicate ? `File "${name}" sudah ada dalam database.` : `File "${name}" belum ada (unik).`,
      });
    }

    // Batch items check
    const results = await checkDuplicateBatch(items);
    const duplicates = results.filter((r) => r.isDuplicate);
    const uniques = results.filter((r) => !r.isDuplicate);

    return NextResponse.json({
      success: true,
      totalChecked: items.length,
      duplicateCount: duplicates.length,
      uniqueCount: uniques.length,
      results: results.map((r) => ({
        index: r.index,
        name: r.name,
        isDuplicate: r.isDuplicate,
        existingId: r.matchedFile?.id || null,
        existingVault: r.matchedFile?.vault_name || null,
      })),
      message: `Pengecekan selesai: ${duplicates.length} duplikat ditemukan, ${uniques.length} file unik.`,
    });
  } catch (error: any) {
    console.error('[CHECK-DUPLICATE-ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CHECK_ERROR', message: error.message || 'Gagal memeriksa duplikasi file.' },
      },
      { status: 500 }
    );
  }
}
