require('dotenv').config();
const http = require('http');
const app = require('../api/index');

const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;

  async function testUrl(description, path, headers = {}) {
    const res = await fetch(`http://localhost:${port}${path}`, { headers });
    const json = await res.json();
    console.log(`[${res.status}] ${description} =>`, res.status === 200 ? (Array.isArray(json) ? `${json.length} items` : 'OK') : json.error?.message);
  }

  try {
    console.log('\n--- 1. Testing Unauthenticated Access (expect 401) ---');
    await testUrl('Unauthenticated GET /provinces', '/provinces');

    console.log('\n--- 2. Testing Auth Modes (expect 200) ---');
    await testUrl('X-User-ID: 1 (Numeric ID)', '/provinces', { 'x-user-id': '1' });
    await testUrl('X-User-ID: national_admin (Username)', '/provinces', { 'x-user-id': 'national_admin' });
    await testUrl('Authorization: Bearer 1 (Bearer ID)', '/provinces', { 'authorization': 'Bearer 1' });
    await testUrl('Authorization: Bearer national_admin (Bearer Username)', '/provinces', { 'authorization': 'Bearer national_admin' });
    await testUrl('Query param ?user_id=1', '/provinces?user_id=1');
    await testUrl('Query param ?username=national_admin', '/provinces?username=national_admin');

    console.log('\n--- 3. Testing Login Response ---');
    const loginRes = await fetch(`http://localhost:${port}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'national_admin', password: 'Admin@123' })
    });
    const loginData = await loginRes.json();
    console.log(`[${loginRes.status}] Login Response =>`, loginData);

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
