import { resolveRemoteSourceUrl, isTeraboxUrl, extractTeraboxDownloadUrl } from './lib/remote-source.ts';

const teraboxUrl = 'https://1024terabox.com/s/1ir4V4e7Usb2eRbhlIKpDXg';

console.log('=== Terabox URL Test ===\n');
console.log('Input URL:', teraboxUrl);
console.log('Is Terabox URL:', isTeraboxUrl(teraboxUrl));

console.log('\n[1] Testing URL resolution...');
console.log('Fetching page and extracting download link...\n');

// Test fetch
fetch(teraboxUrl, {
  method: 'GET',
  redirect: 'follow',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }
})
.then(res => {
  console.log('Status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));
  return res.text();
})
.then(html => {
  console.log('HTML Size:', (html.length / 1024).toFixed(2), 'KB');
  
  // Look for common patterns
  const patterns = [
    { name: 'dlink pattern 1', regex: /"dlink"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+)"/ },
    { name: 'dlink pattern 2', regex: /"dlink"\s*:\s*"(https?:\/\/[^"\\]+)"/ },
    { name: 'downloadUrl', regex: /"downloadUrl"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+)"/ },
    { name: 'download_url', regex: /"download_url"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+)"/ },
  ];
  
  console.log('\n[2] Checking patterns:\n');
  
  for (const {name, regex} of patterns) {
    const match = html.match(regex);
    if (match) {
      console.log(`✓ ${name}: Found`);
      const url = match[1].replace(/\\\//g, '/');
      console.log(`  URL: ${url.substring(0, 80)}...`);
    } else {
      console.log(`✗ ${name}: Not found`);
    }
  }
  
  // Check for window.__INITIAL_STATE__
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?/);
  if (jsonMatch) {
    console.log('\n✓ Found window.__INITIAL_STATE__');
    const jsonStr = jsonMatch[1];
    console.log(`  Size: ${(jsonStr.length / 1024).toFixed(2)} KB`);
    
    // Try to extract dlink from JSON
    const dlinkMatch = jsonStr.match(/"dlink"\s*:\s*"([^"\\]+)"/);
    if (dlinkMatch) {
      console.log(`  dlink found: ${dlinkMatch[1].substring(0, 80)}...`);
    }
  } else {
    console.log('\n✗ window.__INITIAL_STATE__ not found');
  }
})
.catch(err => {
  console.error('Error:', err.message);
});

// Wait for async operations
setTimeout(() => {
  console.log('\n[Test completed]');
  process.exit(0);
}, 10000);
