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
      title: 'RULLZYE CLOUD — REST API Full Integration Suite',
      description: 'API Publik & Privat untuk integrasi cloud storage, streaming video resolusi tinggi, render thumbnail cepat, dan sinkronisasi metadata dengan Netlify / Custom Frontend.',
      version: '2.5.0',
      contact: {
        name: 'RULLZYE CLOUD Developer Support',
        url: baseUrl,
      },
    },
    servers: [
      {
        url: `${baseUrl}/api/v1/public`,
        description: 'Public REST API Server (Render / Cloud Run / Production)',
      },
      {
        url: `${baseUrl}/api`,
        description: 'Internal System & Dashboard API Server',
      },
    ],
    paths: {
      '/status': {
        get: {
          summary: 'Get Backend Server Health & Storage Stats',
          description: 'Mengembalikan status 24/7 online, jumlah file, ukuran repositori, dan latensi sistem.',
          responses: {
            '200': {
              description: 'Server status OK',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    status: 'ONLINE',
                    uptime: '99.99%',
                    total_files: 142,
                    database: 'Google Cloud Firestore',
                    storage: 'Telegram Forum Topics Cloud Engine'
                  }
                }
              }
            },
          },
        },
      },
      '/files': {
        get: {
          summary: 'List Public Files with Pagination & Search',
          description: 'Mengambil daftar file publik lengkap dengan direct link, thumbnail URL, dan ukuran.',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Kata kunci pencarian nama file' },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['ALL', 'PHOTOS', 'VIDEOS', 'FILES'] }, description: 'Filter tipe file' },
            { name: 'vault_id', in: 'query', schema: { type: 'string' }, description: 'ID Vault / Kategori Topic' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 }, description: 'Jumlah item per halaman' },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Offset pagination' },
          ],
          responses: {
            '200': {
              description: 'Array data file',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    total: 1,
                    files: [
                      {
                        id: 'file_1723548912_abc',
                        name: 'RULLZYE 1.mp4',
                        type: 'video',
                        mime: 'video/mp4',
                        size: 28450120,
                        size_formatted: '27.13 MB',
                        vault_id: 'vault_general',
                        vault_name: 'General Storage',
                        download_url: `${baseUrl}/api/v1/public/download/file_1723548912_abc`,
                        preview_url: `${baseUrl}/api/v1/public/download/file_1723548912_abc?inline=true`,
                        stream_url: `${baseUrl}/api/v1/public/download/file_1723548912_abc?inline=true`,
                        thumbnail_url: `${baseUrl}/api/v1/public/thumbnail/file_1723548912_abc`
                      }
                    ]
                  }
                }
              }
            },
          },
        },
      },
      '/thumbnail/{id}': {
        get: {
          summary: 'Get Fast High-Resolution Media Thumbnail',
          description: 'Menyajikan gambar thumbnail cepat untuk video atau foto (cache 7 hari, bandwidth ringan).',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID unik file' },
          ],
          responses: {
            '200': {
              description: 'Binary JPEG / PNG / SVG Image Stream',
              content: {
                'image/jpeg': {},
                'image/svg+xml': {}
              }
            },
            '404': { description: 'File tidak ditemukan' }
          }
        }
      },
      '/media': {
        get: {
          summary: 'Fetch Public Media for Netlify Client Site',
          description: 'Mengembalikan array video & foto yang sudah terformat rapi untuk galeri Netlify.',
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string', enum: ['ALL', 'PHOTOS', 'VIDEOS', 'DOCUMENTS'] } },
            { name: 'vault_id', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          ],
          responses: {
            '200': {
              description: 'Array media',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    count: 1,
                    media: [
                      {
                        id: 'file_1723548912_abc',
                        title: 'RULLZYE 1.mp4',
                        type: 'video',
                        size_bytes: 28450120,
                        size_formatted: '27.13 MB',
                        media_url: `${baseUrl}/api/v1/public/download/file_1723548912_abc?inline=true`,
                        download_url: `${baseUrl}/api/v1/public/download/file_1723548912_abc`,
                        thumbnail_url: `${baseUrl}/api/v1/public/thumbnail/file_1723548912_abc`,
                        views: 450,
                        likes: 85
                      }
                    ]
                  }
                }
              }
            },
          },
        },
      },
      '/download/{id}': {
        get: {
          summary: 'Stream / Download Binary File (HTTP 206 Partial Content Support)',
          description: 'Streaming file / video ukuran besar (> 15MB, 50MB, 100MB) langsung dari cloud storage dengan dukungan range request buffer ultra cepat.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'inline', in: 'query', schema: { type: 'boolean' }, description: 'true untuk streaming langsung di browser video player, false untuk force download' },
          ],
          responses: {
            '200': { description: 'Binary stream data (Full payload)' },
            '206': { description: 'Partial Content stream for Video Range Seek' },
            '404': { description: 'File tidak ditemukan' },
          },
        },
      },
      '/config': {
        get: {
          summary: 'Get Public Site Settings & Ads Monetization Config',
          description: 'Mengambil nama website, kategori vault publik, dan konfigurasi iklan popunder/banner.',
          responses: {
            '200': { description: 'Konfigurasi publik' }
          }
        }
      },
      '/project-export': {
        get: {
          summary: 'Download Standalone Netlify Client Project ZIP',
          description: 'Menghasilkan dan mengunduh paket lengkap HTML, CSS, JS frontend Netlify yang siap di-deploy.',
          responses: {
            '200': { description: 'ZIP file binary download' },
          },
        },
      },
    },
  };

  return jsonWithCors(openApiSpec);
}
