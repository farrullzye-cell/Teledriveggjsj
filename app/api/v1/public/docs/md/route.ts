import { NextRequest, NextResponse } from 'next/server';
import { generateApiDocsMarkdown } from '@/lib/docs-markdown';

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin || 'https://rullzye-cloud.web.app';
    const markdownContent = generateApiDocsMarkdown(origin);

    return new NextResponse(markdownContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="RULLZYE_CLOUD_API_DOCS.md"',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate markdown docs' },
      { status: 500 }
    );
  }
}
