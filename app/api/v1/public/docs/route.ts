import { NextRequest } from 'next/server';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${protocol}://${host}`;

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'RULLZYE CLOUD — Private Storage & Public Media API',
      description: 'REST API Service for connecting Netlify public websites with RULLZYE CLOUD Private Backend hosted on Render / Cloud Run.',
      version: '1.0.0',
      contact: {
        name: 'RULLZYE CLOUD Support',
        url: baseUrl,
      },
    },
    servers: [
      {
        url: `${baseUrl}/api/v1/public`,
        description: 'Private Backend Cloud Server (Render / Cloud Run)',
      },
    ],
    paths: {
      '/status': {
        get: {
          summary: 'Get Backend Server Health & Storage Stats',
          description: 'Returns real-time status, total files stored, total media, and storage usage.',
          responses: {
            '200': { description: 'Successful response' },
          },
        },
      },
      '/files': {
        get: {
          summary: 'List Public Files',
          description: 'Fetch list of stored files with optional filtering by search query, file type, or vault topic.',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search term' },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['ALL', 'PHOTOS', 'VIDEOS', 'FILES'] } },
            { name: 'vault_id', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
          ],
          responses: {
            '200': { description: 'Array of file metadata' },
          },
        },
      },
      '/media': {
        get: {
          summary: 'Fetch Public Media for Netlify Client Site',
          description: 'Returns structured image, video, and file objects formatted for public web galleries.',
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string', enum: ['ALL', 'PHOTOS', 'VIDEOS', 'DOCUMENTS'] } },
            { name: 'vault_id', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Media gallery array' },
          },
        },
      },
      '/download/{id}': {
        get: {
          summary: 'Stream / Download File from Private Storage',
          description: 'Streams binary media/files from Telegram storage through private Render cloud server.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'inline', in: 'query', schema: { type: 'boolean' }, description: 'Set to true for live browser preview (images/video)' },
          ],
          responses: {
            '200': { description: 'Binary file stream' },
            '404': { description: 'File not found' },
          },
        },
      },
      '/project-export': {
        get: {
          summary: 'Download Netlify Public Website Project ZIP',
          description: 'Generates and downloads a complete standalone HTML/CSS/JS Netlify client package pre-configured to connect to this Render backend.',
          responses: {
            '200': { description: 'ZIP file containing Netlify public website code' },
          },
        },
      },
    },
  };

  return jsonWithCors(openApiSpec);
}
