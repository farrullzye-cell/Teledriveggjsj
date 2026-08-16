const teraboxUrl = 'https://1024terabox.com/s/1ir4V4e7Usb2eRbhlIKpDXg';

console.log('Fetching Terabox page...\n');

fetch(teraboxUrl, {
  method: 'GET',
  redirect: 'follow',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }
})
.then(res => res.text())
.then(html => {
  console.log('=== HTML Content (First 2000 chars) ===\n');
  console.log(html.substring(0, 2000));
  
  console.log('\n\n=== Searching for common keys ===\n');
  
  const keywords = [
    'dlink', 'download', 'url', 'link', 'src', 'href',
    'token', 'share', 'file', 'video', 'mp4', 'access'
  ];
  
  for (const keyword of keywords) {
    if (html.includes(keyword)) {
      // Find context around keyword
      const idx = html.indexOf(keyword);
      const start = Math.max(0, idx - 50);
      const end = Math.min(html.length, idx + 150);
      console.log(`✓ "${keyword}" found:`);
      console.log(`  ${html.substring(start, end)}`);
      console.log();
    }
  }
  
  // Try to find any URL patterns
  console.log('\n=== URL Patterns ===\n');
  const urlPattern = /https?:\/\/[^\s"'<>]+/g;
  const urls = html.match(urlPattern) || [];
  const uniqueUrls = [...new Set(urls)];
  
  console.log(`Found ${uniqueUrls.length} unique URLs:\n`);
  uniqueUrls.slice(0, 10).forEach(url => {
    console.log(`- ${url.substring(0, 100)}`);
  });
})
.catch(err => {
  console.error('Error:', err.message);
})
.finally(() => process.exit(0));
