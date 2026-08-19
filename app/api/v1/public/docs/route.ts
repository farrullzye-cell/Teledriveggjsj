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
      title: 'RULLZYE CLOUD — REST API & Ads Monetization Full Integration Suite',
      description: 'Dokumentasi lengkap seluruh REST API endpoint untuk Cloud Media Storage, Video Streaming 206, Render Thumbnail Ultra-Cepat, Manajemen Vaults, Bot Telegram Sync, serta Engine Iklan & Monetisasi (Popunder, Native, Top Banner, Video Overlay).',
      version: '3.0.0',
      contact: {
        name: 'RULLZYE CLOUD Developer Support',
        url: baseUrl,
      },
    },
    servers: [
      {
        url: `${baseUrl}/api/v1/public`,
        description: 'Public REST API & Media CDN (CORS Enabled untuk Netlify / Web Client)',
      },
      {
        url: `${baseUrl}/api`,
        description: 'Internal & Dashboard Core Management API',
      },
    ],
    tags: [
      { name: 'Google Drive Vaults', description: 'Google Drive folder mappings, recursive auto-detection, dan cloud file sync' },
      { name: 'Video REST API', description: 'Katalog video, pencarian, popular, latest, dan direct player streaming' },
      { name: 'Public CDN & Streaming', description: 'Endpoint publik untuk streaming video, thumbnail, galeri media, dan likes' },
      { name: 'Ads & Monetization', description: 'Pengaturan iklan popunder, Smartlink CPM click validation, banner header, native in-feed, dan player overlay' },
      { name: 'File Storage Management', description: 'Upload bulk video, rename, delete, move, dan statistik file' },
      { name: 'Vault & Topics', description: 'Manajemen kategori direktori & Telegram Forum Topics' },
      { name: 'Telegram Bot Engine', description: 'Background poller, webhook, restore metadata, dan create topic' },
      { name: 'System & Security', description: 'Verifikasi PIN, konfigurasi bot token, dan healthcheck status' },
    ],
    paths: {
      // 0. GOOGLE DRIVE VAULTS & AUTO-DETECTION
      '/api/v1/drive/sync': {
        post: {
          tags: ['Google Drive Vaults'],
          summary: 'Scan & Auto-Detect New Google Drive Uploads',
          description: 'Memindai seluruh folder Vault di Google Drive secara rekursif, mendeteksi video/file baru yang diunggah langsung ke Drive, dan secara otomatis mengindeksnya ke Firestore.',
          responses: {
            '200': {
              description: 'Hasil auto-detection dan sinkronisasi file baru',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    data: {
                      newCount: 2,
                      totalScanned: 24,
                      vaultsScanned: 4,
                      newFiles: []
                    },
                    message: 'Berhasil mendeteksi & menyinkronkan 2 file baru dari Google Drive Vault!'
                  }
                }
              }
            }
          }
        },
        get: {
          tags: ['Google Drive Vaults'],
          summary: 'Scan & Auto-Detect (GET Trigger)',
          description: 'Memicu scan dan sinkronisasi berkas Google Drive melalui GET request (cocok untuk Cron job berkala).',
          responses: {
            '200': { description: 'Hasil sinkronisasi berkas' }
          }
        }
      },
      '/api/v1/drive/vaults': {
        get: {
          tags: ['Google Drive Vaults'],
          summary: 'Get All Vault Google Drive Folder Mappings',
          description: 'Mengambil daftar Vaults beserta folder ID Google Drive yang terhubung, status sinkronisasi, dan jumlah file di Drive.',
          responses: {
            '200': { description: 'Daftar Vault beserta metadata Google Drive folder' }
          }
        },
        post: {
          tags: ['Google Drive Vaults'],
          summary: 'Initialize & Align Vault Folders in Google Drive',
          description: 'Membuat atau menyelaraskan struktur folder untuk seluruh Topic Vault di Google Drive secara otomatis.',
          responses: {
            '200': { description: 'Folder Vault berhasil diselaraskan di Google Drive' }
          }
        }
      },
      '/api/v1/drive/files': {
        get: {
          tags: ['Google Drive Vaults'],
          summary: 'List Files in Google Drive Vault Folder',
          description: 'Membaca daftar file langsung dari Google Drive dengan paginasi dan filter MIME type video / gambar.',
          parameters: [
            { name: 'folder_id', in: 'query', schema: { type: 'string' }, description: 'ID Folder Google Drive' },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Jumlah item per halaman' }
          ],
          responses: {
            '200': { description: 'Array file Google Drive' }
          }
        }
      },
      '/api/v1/drive/import': {
        post: {
          tags: ['Google Drive Vaults'],
          summary: 'Import Specific Google Drive File to Vault Catalog',
          description: 'Mengindeks file yang sudah ada di Google Drive ke katalog RULLZYE CLOUD dengan otomatis membuat link publik dan thumbnail.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    fileId: { type: 'string', description: 'ID File Google Drive' },
                    name: { type: 'string', description: 'Nama judul kustom' },
                    vault_id: { type: 'string', description: 'ID Vault target' }
                  },
                  required: ['fileId']
                }
              }
            }
          },
          responses: {
            '200': { description: 'File berhasil diimpor ke katalog' }
          }
        }
      },

      // 1. VIDEO REST API (STANDARD CATALOG)
      '/api/v1/videos': {
        get: {
          tags: ['Video REST API'],
          summary: 'List All Videos with Pagination & Category Filters',
          description: 'Mengambil katalog video lengkap dengan URL streaming Google Drive, thumbnail poster, embed URL, jumlah views, likes, dan kategori.',
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Nama kategori atau slug' },
            { name: 'vault_id', in: 'query', schema: { type: 'string' }, description: 'ID Topic Vault target' },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Nomor halaman' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Jumlah per halaman' },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Kata kunci pencarian' }
          ],
          responses: {
            '200': { description: 'Katalog video terformat' }
          }
        }
      },
      '/api/v1/videos/{id}': {
        get: {
          tags: ['Video REST API'],
          summary: 'Get Video Details & Direct Play URL',
          description: 'Mengambil rincian video tertentu termasuk watch_url, embed_url, direct stream link dari Google Drive, thumbnail, dan related videos.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID file video' }
          ],
          responses: {
            '200': { description: 'Detail video' }
          }
        }
      },
      '/api/v1/videos/search': {
        get: {
          tags: ['Video REST API'],
          summary: 'Search Videos by Title, Tag or Topic',
          description: 'Pencarian cepat video dengan keyword query.',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
          ],
          responses: {
            '200': { description: 'Hasil pencarian video' }
          }
        }
      },
      '/api/v1/videos/latest': {
        get: {
          tags: ['Video REST API'],
          summary: 'Get Latest Uploaded Videos',
          description: 'Mengambil daftar video terbaru yang diunggah ke Google Drive Vault.',
          responses: {
            '200': { description: 'Array video terbaru' }
          }
        }
      },
      '/api/v1/videos/popular': {
        get: {
          tags: ['Video REST API'],
          summary: 'Get Trending & Most Viewed Videos',
          description: 'Mengambil video terpopuler berdasarkan jumlah views dan likes.',
          responses: {
            '200': { description: 'Array video terpopuler' }
          }
        }
      },
      '/watch/{id}': {
        get: {
          tags: ['Video REST API'],
          summary: 'Responsive Video Player Web Page',
          description: 'Halaman pemutar video mandiri responsif dengan dukungan auto-fullscreen, theater mode, metadata info, dan Smartlink monetization.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'HTML Video Player Page' }
          }
        }
      },
      '/embed/{id}': {
        get: {
          tags: ['Video REST API'],
          summary: 'Iframe-Ready Embeddable Video Player',
          description: 'Player video ringan tanpa navbar yang dirancang khusus untuk di-embed ke website eksternal menggunakan <iframe>.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'HTML Iframe Embed Video Player' }
          }
        }
      },
      '/api/v1/monetization/click': {
        post: {
          tags: ['Ads & Monetization'],
          summary: 'Validate & Trigger Smartlink Monetization Click',
          description: 'Server-side click validator yang menghitung urutan klik pemutaran video (interval 1-5) dan mengembalikan URL Smartlink jika tercapai.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    videoId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Hasil validasi interval klik monetisasi' }
          }
        }
      },

      // 2. PUBLIC CDN & STREAMING
      '/media': {
        get: {
          tags: ['Public CDN & Streaming'],
          summary: 'Get Formatted Media Gallery Collection',
          description: 'Mengambil daftar seluruh media video dan foto dengan metadata lengkap (thumbnail_url, media_url, views, likes, kategori vault) siap konsumsi untuk Netlify client site.',
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string', enum: ['ALL', 'PHOTOS', 'VIDEOS', 'DOCUMENTS'] }, description: 'Filter kategori media' },
            { name: 'vault_id', in: 'query', schema: { type: 'string' }, description: 'Filter spesifik ID Topic Vault' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Jumlah data per request' },
          ],
          responses: {
            '200': {
              description: 'Array Media Collection',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    count: 1,
                    media: [
                      {
                        id: 'file_1723548912_abc',
                        title: 'Video Demo.mp4',
                        type: 'video',
                        size_bytes: 28450120,
                        size_formatted: '27.13 MB',
                        media_url: `${baseUrl}/api/v1/public/download/file_1723548912_abc?inline=true`,
                        download_url: `${baseUrl}/api/v1/public/download/file_1723548912_abc`,
                        thumbnail_url: `${baseUrl}/api/v1/public/thumbnail/file_1723548912_abc`,
                        views: 450,
                        likes: 85,
                        vault_id: 'vault_general',
                        vault_name: 'General Storage'
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      '/media/like': {
        post: {
          tags: ['Public CDN & Streaming'],
          summary: 'Increment Media Likes or Views Count',
          description: 'Menambah jumlah suka (like) atau tayangan (view) untuk file media tertentu tanpa perlu autentikasi.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'ID file target' },
                    action: { type: 'string', enum: ['like', 'view'], default: 'like' }
                  },
                  required: ['id']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Statistik terupdate',
              content: {
                'application/json': {
                  example: { success: true, likes: 86 }
                }
              }
            }
          }
        }
      },
      '/thumbnail/{id}': {
        get: {
          tags: ['Public CDN & Streaming'],
          summary: 'Stream Ultra-Fast High Resolution Thumbnail',
          description: 'Menyajikan gambar thumbnail cepat untuk video atau foto (cache 7 hari, bandwidth super ringan).',
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
      '/download/{id}': {
        get: {
          tags: ['Public CDN & Streaming'],
          summary: 'Stream / Download Binary File (HTTP 206 Partial Content Support)',
          description: 'Streaming file video ukuran besar (> 15MB, 50MB, 100MB) langsung dari cloud storage dengan dukungan range request buffer ultra cepat.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'inline', in: 'query', schema: { type: 'boolean' }, description: 'Set true untuk streaming langsung di tag <video>, false untuk force download' },
          ],
          responses: {
            '200': { description: 'Binary stream data (Full payload)' },
            '206': { description: 'Partial Content stream for Video Range Seek' },
            '404': { description: 'File tidak ditemukan' },
          },
        },
      },
      '/files': {
        get: {
          tags: ['Public CDN & Streaming'],
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
                    files: []
                  }
                }
              }
            },
          },
        },
      },
      '/status': {
        get: {
          tags: ['Public CDN & Streaming'],
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
      '/project-export': {
        get: {
          tags: ['Public CDN & Streaming'],
          summary: 'Download Standalone Netlify Client Project ZIP',
          description: 'Menghasilkan dan mengunduh paket lengkap HTML, CSS, JS frontend Netlify yang siap di-deploy.',
          responses: {
            '200': { description: 'ZIP file binary download' },
          },
        },
      },

      // 2. ADS & MONETIZATION & CONFIG
      '/config': {
        get: {
          tags: ['Ads & Monetization'],
          summary: 'Get Public Site Settings & Ads Monetization Engine',
          description: 'Mengambil konfigurasi publik lengkap mencakup branding, daftar Vaults, dan semua tag iklan CPM / Ad Network (Popunder, Top Banner, Video Player Overlay, Native Ad).',
          responses: {
            '200': {
              description: 'Konfigurasi iklan dan situs publik',
              content: {
                'application/json': {
                  example: {
                    success: true,
                    site: {
                      title: 'XVIDSHUB',
                      tagline: 'High Speed Video Streaming & Media Portal',
                      server_url: baseUrl
                    },
                    categories: [
                      { id: 'vault_general', name: 'General Storage', description: 'Default storage', icon: 'Folder', color: 'cyan' }
                    ],
                    monetization: {
                      enabled: true,
                      popunder_rate: 100,
                      popunder_url: 'https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js',
                      banner_top_html: '<div class="banner-ad">...</div>',
                      player_overlay_html: '<div class="player-overlay">...</div>',
                      native_ad_html: '<div class="native-ad">...</div>'
                    }
                  }
                }
              }
            }
          }
        }
      },

      // 3. CORE FILE & STORAGE MANAGEMENT
      '/api/files': {
        get: {
          tags: ['File Storage Management'],
          summary: 'List Dashboard Files with Vault Filters & Pagination',
          description: 'Mengambil katalog berkas dashboard dengan metadata teknis Telegram (chat_id, message_id, file_id).',
          responses: {
            '200': { description: 'Daftar berkas terperinci' }
          }
        },
        post: {
          tags: ['File Storage Management'],
          summary: 'Upload Single / Multi / Bulk Compressed Videos',
          description: 'Mengunggah file atau batch video hasil kompresi langsung ke Telegram Storage Vault dengan live progress tracking.',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary', description: 'Single file payload' },
                    files: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Multiple files' },
                    vault_id: { type: 'string', description: 'ID Vault target penyimpanan' },
                    custom_name: { type: 'string', description: 'Kustom nama file (opsional)' },
                    keep_original_name: { type: 'string', enum: ['true', 'false'], description: 'Pertahankan nama asli tanpa sequence' },
                    thumbnail_base64: { type: 'string', description: 'Base64 data URL untuk custom thumbnail' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Upload berhasil dan tersinkronisasi ke Telegram & Firestore' }
          }
        }
      },
      '/api/files/{id}': {
        patch: {
          tags: ['File Storage Management'],
          summary: 'Rename File Record',
          description: 'Mengubah nama file pada database Firestore tanpa merusak file di Telegram.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Nama baru untuk file' }
                  },
                  required: ['name']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Nama file berhasil diperbarui' }
          }
        },
        delete: {
          tags: ['File Storage Management'],
          summary: 'Delete File from Storage & Telegram',
          description: 'Menghapus file dari database dan menarik pesan berkas dari Telegram Cloud Group.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'File berhasil dihapus permanen' }
          }
        }
      },
      '/api/files/{id}/move': {
        post: {
          tags: ['File Storage Management'],
          summary: 'Move File to Another Topic Vault',
          description: 'Memindahkan file antar Topic Vault/Kategori.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    vault_id: { type: 'string', description: 'ID Vault tujuan' }
                  },
                  required: ['vault_id']
                }
              }
            }
          },
          responses: {
            '200': { description: 'File berhasil dipindahkan' }
          }
        }
      },
      '/api/files/stats': {
        post: {
          tags: ['File Storage Management'],
          summary: 'Update Manual Views & Likes Metrics',
          description: 'Mengatur atau memperbarui angka tayangan dan jumlah suka pada file.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    file_id: { type: 'string' },
                    views: { type: 'number' },
                    likes: { type: 'number' }
                  },
                  required: ['file_id']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Statistik tersimpan' }
          }
        }
      },

      // 4. VAULTS & TOPICS
      '/api/vaults': {
        get: {
          tags: ['Vault & Topics'],
          summary: 'List All Storage Vaults & Topics',
          description: 'Mengambil daftar semua Topic Vaults beserta jumlah file dan ID Thread Telegram.',
          responses: {
            '200': { description: 'Array data Vaults' }
          }
        },
        post: {
          tags: ['Vault & Topics'],
          summary: 'Create New Topic Vault with Auto Telegram Forum Topic',
          description: 'Membuat Vault baru dan secara otomatis membuat Forum Topic baru di Supergroup Telegram.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Nama kategori Vault' },
                    description: { type: 'string' },
                    icon: { type: 'string', enum: ['Folder', 'Film', 'FileText', 'ShieldLock', 'Database', 'Sparkles'] },
                    color: { type: 'string', enum: ['cyan', 'amber', 'sky', 'emerald', 'rose', 'purple'] },
                    topic_id: { type: 'string', description: 'ID Thread Telegram (opsional jika dibuat manual)' }
                  },
                  required: ['name']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Vault berhasil dibuat' }
          }
        },
        delete: {
          tags: ['Vault & Topics'],
          summary: 'Delete Vault Topic',
          description: 'Menghapus kategori Vault dan memindahkan file ke General.',
          parameters: [
            { name: 'id', in: 'query', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'Vault dihapus' }
          }
        }
      },

      // 5. TELEGRAM BOT ENGINE
      '/api/telegram/poll': {
        get: {
          tags: ['Telegram Bot Engine'],
          summary: 'Check Background Long Poller Status & Sync Updates',
          description: 'Mengecek apakah poller bot aktif dan mengambil status event terbaru.',
          responses: {
            '200': { description: 'Status polling' }
          }
        },
        post: {
          tags: ['Telegram Bot Engine'],
          summary: 'Start, Stop or Force Run Poller',
          description: 'Mengontrol daemons sinkronisasi berkas bot Telegram secara real-time.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', enum: ['start', 'stop', 'once'] }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Aksi poller berhasil dieksekusi' }
          }
        }
      },
      '/api/telegram/webhook': {
        post: {
          tags: ['Telegram Bot Engine'],
          summary: 'Telegram Incoming Webhook Handler',
          description: 'Menerima callback real-time dari Telegram Bot API saat pengguna mengirim dokumen atau video ke bot.',
          responses: {
            '200': { description: 'Webhook diproses' }
          }
        }
      },
      '/api/telegram/set-webhook': {
        post: {
          tags: ['Telegram Bot Engine'],
          summary: 'Register Webhook URL with Secret Token',
          description: 'Mendaftarkan endpoint webhook aplikasi ke server Telegram Bot.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    webhook_url: { type: 'string' },
                    secret_token: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Webhook terdaftar' }
          }
        }
      },
      '/api/telegram/restore': {
        get: {
          tags: ['Telegram Bot Engine'],
          summary: 'Check Telegram Metadata Backup Status',
          description: 'Mengecek ketersediaan backup file database.json di Telegram Chat.',
          responses: {
            '200': { description: 'Status backup Telegram' }
          }
        },
        post: {
          tags: ['Telegram Bot Engine'],
          summary: 'Restore Database from Telegram Backup JSON',
          description: 'Merekonstruksi database dan seluruh riwayat berkas dari postingan backup di chat storage Telegram.',
          responses: {
            '200': { description: 'Database berhasil dipulihkan' }
          }
        }
      },
      '/api/telegram/topic': {
        post: {
          tags: ['Telegram Bot Engine'],
          summary: 'Create Telegram Forum Topic Directly',
          description: 'Membuat forum topic baru di Telegram Supergroup dan membackup snapshot database.',
          responses: {
            '200': { description: 'Topic berhasil dibuat' }
          }
        }
      },

      // 6. SYSTEM CONFIGURATION & SECURITY
      '/api/config/save': {
        post: {
          tags: ['System & Security'],
          summary: 'Save System Settings, Bot Token & Ads Monetization Tags',
          description: 'Menyimpan konfigurasi sistem, token bot telegram, chat ID, PIN admin baru, dan seluruh script iklan ads (Popunder, Banners, Native, Overlay).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    website_name: { type: 'string' },
                    telegram_bot_token: { type: 'string' },
                    telegram_chat_id: { type: 'string' },
                    current_pin: { type: 'string', description: 'PIN admin saat ini untuk otentikasi' },
                    new_pin: { type: 'string', description: 'PIN admin baru (opsional)' },
                    ad_monetization_enabled: { type: 'boolean', description: 'Status aktifasi iklan' },
                    ad_popunder_rate: { type: 'number', enum: [20, 30, 50, 100], description: 'Persentase pemicu popunder' },
                    ad_popunder_url: { type: 'string', description: 'URL script popunder CPM' },
                    ad_banner_top_html: { type: 'string', description: 'Kode HTML/Script banner header' },
                    ad_player_overlay_html: { type: 'string', description: 'Kode HTML banner pemutar video' },
                    ad_native_html: { type: 'string', description: 'Kode HTML native banner/iklan artikel' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Konfigurasi berhasil disimpan dan disinkronkan' }
          }
        }
      },
      '/api/config/status': {
        get: {
          tags: ['System & Security'],
          summary: 'System Diagnostics & Health Check',
          description: 'Menguji konektivitas Bot Token, akses Storage Chat ID, dan status koneksi Google Cloud Firestore.',
          responses: {
            '200': { description: 'Hasil diagnosa sistem' }
          }
        }
      },
      '/api/verify-pin': {
        post: {
          tags: ['System & Security'],
          summary: 'Authenticate & Verify Admin PIN',
          description: 'Verifikasi keamanan PIN 6-digit untuk mengakses dashboard admin dengan proteksi rate limit lockout.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    pin: { type: 'string', description: 'PIN 6-digit' }
                  },
                  required: ['pin']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Autentikasi PIN Berhasil' },
            '401': { description: 'PIN Salah / Lockout Rate-Limit' }
          }
        }
      },
      '/api/test-telegram': {
        post: {
          tags: ['System & Security'],
          summary: 'Test Telegram Bot Token Connection',
          description: 'Menguji kevalidan Bot Token dengan memanggil getMe Telegram Bot API.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', description: 'Bot token untuk ditest (opsional, jika kosong menggunakan yang tersimpan)' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Bot terhubung' }
          }
        }
      },
      '/api/test-storage': {
        post: {
          tags: ['System & Security'],
          summary: 'Test Telegram Storage Chat Access',
          description: 'Mengirim pesan verifikasi ke Telegram Group / Channel untuk memastikan bot memiliki izin upload.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    chatId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Izin storage valid' }
          }
        }
      },
      '/api/health': {
        get: {
          tags: ['System & Security'],
          summary: 'Liveness & Readiness Health Probe',
          description: 'Endpoint sederhana untuk monitoring uptime container & Cloud Run.',
          responses: {
            '200': {
              description: 'Service Healthy',
              content: {
                'application/json': {
                  example: { status: 'ok', timestamp: 1723548912000 }
                }
              }
            }
          }
        }
      }
    },
  };

  return jsonWithCors(openApiSpec);
}
