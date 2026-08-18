import crypto from 'crypto';

export interface TeraBoxTokenInfo {
  access_token: string;
  expires_in: number;
  api_domain: string;
  upload_domain: string;
}

export class TeraBoxClient {
  private accessToken: string;
  private apiDomain: string = 'https://openapi.terabox.com';
  private uploadDomain: string = 'https://openapi.terabox.com';
  
  constructor() {
    this.accessToken = process.env.TERABOX_ACCESS_TOKEN || '';
    // Typically you'd refresh tokens here if you had the full OAuth flow, 
    // but the prompt mentions keeping it simple or using available tokens.
  }

  // Set domains once we get them from token info
  public setDomains(apiDomain: string, uploadDomain: string) {
    if (apiDomain) this.apiDomain = apiDomain.startsWith('http') ? apiDomain : `https://${apiDomain}`;
    if (uploadDomain) this.uploadDomain = uploadDomain.startsWith('http') ? uploadDomain : `https://${uploadDomain}`;
  }

  private async fetchApi(path: string, options: RequestInit = {}) {
    const url = `${this.apiDomain}${path}`;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.accessToken}`);
    
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_msg || data.message || `Terabox API error: ${res.statusText}`);
    }
    return data;
  }

  public async getUserInfo() {
    return this.fetchApi('/dp-log/userdata');
  }

  public async getQuota() {
    return this.fetchApi('/dp-quota/info');
  }

  public async searchFiles(key: string, page: number = 1, num: number = 20) {
    return this.fetchApi(`/dp-list/search?key=${encodeURIComponent(key)}&page=${page}&num=${num}`);
  }

  public async listFiles(path: string = '/', page: number = 1, num: number = 20) {
    return this.fetchApi(`/dp-list/dir?path=${encodeURIComponent(path)}&page=${page}&num=${num}`);
  }

  public async getDownloadLink(fidlist: string[]) {
    return this.fetchApi(`/dp-download/dlink?fidlist=${JSON.stringify(fidlist)}`);
  }

  public async getStreamingInfo(path: string) {
    return this.fetchApi(`/dp-video/streaming?path=${encodeURIComponent(path)}`);
  }

  public async fileManager(operation: string, filelist: any[]) {
    return this.fetchApi(`/dp-manage/filemanager?opera=${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filelist })
    });
  }

  public async precreate(path: string, size: number, isdir: number, block_list: string[]) {
    // Requires block_list (array of MD5s of chunks)
    const formData = new FormData();
    formData.append('path', path);
    formData.append('size', size.toString());
    formData.append('isdir', isdir.toString());
    formData.append('block_list', JSON.stringify(block_list));
    formData.append('autoinit', '1');

    const res = await fetch(`${this.apiDomain}/dp-upload/precreate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: formData as any
    });
    
    if (!res.ok) {
      throw new Error(`Precreate failed: ${res.statusText}`);
    }
    return res.json();
  }

  public async uploadPart(path: string, uploadid: string, partseq: number, chunk: Buffer) {
    // Construct the upload URL
    const url = `${this.uploadDomain}/dp-upload/superfile2?path=${encodeURIComponent(path)}&uploadid=${encodeURIComponent(uploadid)}&partseq=${partseq}`;
    
    const formData = new FormData();
    // In Node.js environment with native fetch, we can use Blob
    formData.append('file', new Blob([chunk as unknown as BlobPart]), 'blob');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: formData as any
    });
    
    if (!res.ok) {
      throw new Error(`Upload part ${partseq} failed: ${res.statusText}`);
    }
    return res.json();
  }

  public async create(path: string, size: number, isdir: number, block_list: string[], uploadid: string) {
    const formData = new FormData();
    formData.append('path', path);
    formData.append('size', size.toString());
    formData.append('isdir', isdir.toString());
    formData.append('block_list', JSON.stringify(block_list));
    formData.append('uploadid', uploadid);

    const res = await fetch(`${this.apiDomain}/dp-upload/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: formData as any
    });
    
    if (!res.ok) {
      throw new Error(`Create failed: ${res.statusText}`);
    }
    return res.json();
  }
}

export const teraboxClient = new TeraBoxClient();
