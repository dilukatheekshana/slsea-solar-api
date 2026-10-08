require('dotenv').config();
const http = require('http');
const app = require('../api/index');
const { SolarInstallation } = require('../models');

const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  const authHeaders = { 'x-user-id': 'national_admin', 'content-type': 'application/json' };

  try {
    console.log('\n--- 1. Testing GET /installations/1 before update ---');
    const getRes1 = await fetch(`${baseUrl}/installations/1`, { headers: authHeaders });
    const getData1 = await getRes1.json();
    console.log(`[${getRes1.status}] GET /installations/1:`, getData1.name, '| Capacity:', getData1.capacity_kw);

    console.log('\n--- 2. Testing PUT /installations/1 (Updating capacity_kw & name) ---');
    const putRes = await fetch(`${baseUrl}/installations/1`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ capacity_kw: 9.5, name: 'Solar Installation 001 (Updated)' })
    });
    const putData = await putRes.json();
    console.log(`[${putRes.status}] PUT /installations/1:`, putData.name, '| Capacity:', putData.capacity_kw);

    console.log('\n--- 3. Testing GET /installations/1 after update ---');
    const getRes2 = await fetch(`${baseUrl}/installations/1`, { headers: authHeaders });
    const getData2 = await getRes2.json();
    console.log(`[${getRes2.status}] GET /installations/1:`, getData2.name, '| Capacity:', getData2.capacity_kw);

    console.log('\n--- 4. Testing DELETE /installations/1 (Soft Delete) ---');
    const delRes = await fetch(`${baseUrl}/installations/1`, {
      method: 'DELETE',
      headers: authHeaders
    });
    const delData = await delRes.json();
    console.log(`[${delRes.status}] DELETE /installations/1:`, delData);

    console.log('\n--- 5. Testing GET /installations/1 after soft delete (expect 404) ---');
    const getRes3 = await fetch(`${baseUrl}/installations/1`, { headers: authHeaders });
    const getData3 = await getRes3.json();
    console.log(`[${getRes3.status}] GET /installations/1:`, getData3);

    console.log('\n--- 6. Restoring installation 1 in database ---');
    await SolarInstallation.updateOne(
      { id: 1 },
      { is_deleted: false, deleted_at: null, name: 'Solar Installation 001', capacity_kw: 8.0 }
    );
    console.log('Restored installation 1 successfully.');

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
