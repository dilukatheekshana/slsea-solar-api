require('dotenv').config();
const http = require('http');
const app = require('../api/index');

const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  const authHeaders = { 'x-user-id': 'national_admin', 'content-type': 'application/json' };

  async function test(name, path) {
    const res = await fetch(`${baseUrl}${path}`, { headers: authHeaders });
    const data = await res.json();
    console.log(`[${res.status}] ${name} =>`, res.status === 200 ? (Array.isArray(data) ? `${data.length} items` : data.count !== undefined ? `${data.count} total (envelope)` : data.name || data.id) : data);
  }

  try {
    console.log('\n--- Testing New Substation Endpoints ---');
    await test('GET /substations', '/substations');
    await test('GET /substations/1', '/substations/1');

    console.log('\n--- Testing New Reading Endpoints ---');
    await test('GET /readings (all readings across installations)', '/readings');
    await test('GET /readings?installation_id=1', '/readings?installation_id=1');
    await test('GET /readings/1 (single reading by ID)', '/readings/1');
    await test('GET /installations/1/readings/1 (single reading under installation)', '/installations/1/readings/1');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
