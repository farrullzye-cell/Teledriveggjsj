const teraboxUrl = 'https://1024terabox.com/s/1ir4V4e7Usb2eRbhlIKpDXg';
const surl = '1ir4V4e7Usb2eRbhlIKpDXg';

console.log('=== Testing Terabox API Methods ===\n');

// Method 1: Try the API endpoint directly
console.log('[Method 1] Trying Terabox API endpoint...\n');

fetch('https://1024terabox.com/share/download', {
  method: 'POST',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    surl: surl,
    timestamp: Date.now(),
  })
})
.then(res => {
  console.log('Status:', res.status);
  return res.json().catch(() => res.text());
})
.then(data => {
  console.log('Response:', JSON.stringify(data, null, 2));
})
.catch(err => {
  console.log('Error (Method 1):', err.message);
});

// Method 2: Try to fetch page and extract all data objects
setTimeout(() => {
  console.log('\n[Method 2] Fetching full page data...\n');
  
  fetch(teraboxUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  })
  .then(res => res.text())
  .then(html => {
    // Look for window.taskData or similar
    const dataMatches = html.match(/window\.\w+\s*=\s*\{[^}]*?"(?:dlink|download|share|url)"[^}]*\}/g) || [];
    console.log(`Found ${dataMatches.length} data objects`);
    
    // Look for JSON in script tags
    const scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
    console.log(`Found ${scriptMatches.length} script tags`);
    
    // Extract all JSON-like objects
    const jsonMatches = html.match(/\{[^{}]*?"(?:url|link|dlink|download)"[^{}]*?\}/g) || [];
    console.log(`Found ${jsonMatches.length} JSON objects with download info`);
    
    if (jsonMatches.length > 0) {
      console.log('\nFirst few matches:');
      jsonMatches.slice(0, 3).forEach((match, i) => {
        console.log(`\n${i+1}. ${match.substring(0, 150)}...`);
      });
    }
    
    // Search for any download-related patterns
    const downloadPatterns = html.match(/(?:https?:\/\/[^\s"'<>]*\.(?:terabox|teraboxcdn|teraboxapp)[^\s"'<>]*)/g) || [];
    const uniqueDownloads = [...new Set(downloadPatterns)];
    
    console.log(`\nFound ${uniqueDownloads.length} Terabox URLs:`);
    uniqueDownloads.forEach(url => {
      console.log(`- ${url.substring(0, 100)}`);
    });
  })
  .catch(err => {
    console.log('Error (Method 2):', err.message);
  })
  .finally(() => {
    process.exit(0);
  });
}, 2000);

setTimeout(() => {
  console.log('\n[Test timeout]');
  process.exit(1);
}, 15000);
