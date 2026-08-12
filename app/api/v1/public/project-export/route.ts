import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { getCorsHeaders, handleCorsOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const zip = new JSZip();

    // Directory containing Netlify site files
    const netlifySiteDir = path.join(process.cwd(), 'public', 'netlify-site');

    if (fs.existsSync(netlifySiteDir)) {
      const files = fs.readdirSync(netlifySiteDir);
      for (const file of files) {
        const filePath = path.join(netlifySiteDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const content = fs.readFileSync(filePath);
          zip.file(file, content);
        }
      }
    } else {
      // Fallback if directory does not exist on runtime filesystem
      const host = req.headers.get('host') || 'localhost:3000';
      const protocol = req.headers.get('x-forwarded-proto') || 'https';
      const baseUrl = `${protocol}://${host}`;

      zip.file(
        'index.html',
        `<!DOCTYPE html><html><head><title>Netlify Client Site</title></head><body><h1>RULLZYE CLOUD Netlify Site</h1><p>Connected to ${baseUrl}</p></body></html>`
      );
      zip.file('netlify.toml', '[build]\n  publish = "."\n');
      zip.file('README.md', '# RULLZYE CLOUD Public Site\nDeploy to Netlify Drop.');
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    const corsHeaders = getCorsHeaders();
    const headers = new Headers({
      ...corsHeaders,
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="netlify-public-website.zip"',
      'Content-Length': String(zipBuffer.length),
    });

    return new NextResponse(zipBuffer as any, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error('Project export error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal mengeksport project ZIP: ' + err.message },
      { status: 500 }
    );
  }
}
