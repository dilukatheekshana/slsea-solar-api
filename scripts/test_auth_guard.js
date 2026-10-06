require('dotenv').config();
const http = require('http');
const app = require('../api/index');

const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  async function testUrl(path, headers = {}) {
    const res = await fetch(`http://localhost:${port}${path}`, { headers });
    const json = await res.json();
    console.log(`[${res.status}] ${path} (${JSON.stringify(headers)}) =>`, json.error ? json.error.message : `${Array.isArray(json) ? json.length + ' items' : 'OK'}`);
  }

  try {
    console.log('\n--- 1. Testing Unauthenticated Access (expect 401) ---');
    await testUrl('/provinces');
    await testUrl('/districts');
    await testUrl('/installations');
    await testUrl('/provinces/1');

    console.log('\n--- 2. Testing Authenticated Access (X-User-ID: 1) (expect 200) ---');
    await testUrl('/provinces', { 'x-user-id': '1' });
    await testUrl('/districts', { 'x-user-id': '1' });
    await testUrl('/installations', { 'x-user-id': '1' });
    await testUrl('/provinces/1', { 'x-user-id': '1' });

    console.log('\n--- 3. Testing Public Endpoints (expect 200) ---');
    await testUrl('/');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
