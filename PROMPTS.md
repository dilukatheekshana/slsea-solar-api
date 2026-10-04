# SLSEA Solar Generation API — Chronological Prompt Log

This document records the exact sequential prompt instructions used to construct the **SLSEA Solar Generation API** project on branch `dev`.

---

## 📌 Phase 1: Environment Setup & Vercel Routing Scaffolding

```text
Please execute the complete project initialization and minimal server setup for our SLSEA Solar API on branch dev:

1. Environment & Package Setup:
   - Initialize the npm project if package.json does not exist (npm init -y).
   - Install production dependencies: express, mongoose, cors, dotenv, and swagger-ui-express.
   - Install dev dependencies: nodemon.
   - Ensure package.json includes scripts:
     * "start": "node api/index.js"
     * "dev": "nodemon api/index.js"

2. Serverless Routing Configuration:
   - Create `vercel.json` in the root directory:
     {
       "version": 2,
       "builds": [
         { "src": "api/index.js", "use": "@vercel/node" }
       ],
       "routes": [
         { "src": "/(.*)", "dest": "api/index.js" }
       ]
     }

3. Minimal Server Entrypoint with Connection Caching (`api/index.js`):
   - Import express, mongoose, cors, and dotenv.
   - Configure Express app with cors() and express.json().
   - Implement cached MongoDB connection pooling using `process.env.MONGO_URI` to prevent serverless connection exhaustion on Vercel:
     * Cache connection state so repeated lambda invocations reuse existing connections.
     * Add middleware that ensures database connectivity before processing incoming requests.
   - Add a root route `GET /`:
     * Returns HTTP 200 JSON:
       {
         "status": "operational",
         "authority": "Sri Lanka Sustainable Energy Authority",
         "version": "1.0.0",
         "database": isConnected ? "connected" : "disconnected"
       }
   - Local listener fallback: If process.env.NODE_ENV !== 'production', listen on process.env.PORT || 3000.
   - Export app with `module.exports = app`.

4. Git Commit:
   - Stage package.json, package-lock.json, vercel.json, and api/index.js.
   - Commit with message: "chore: scaffold express application with vercel serverless routing" and push to branch dev.
```

---

## 📌 Phase 2: Read-Only Scoped Hierarchy Routes

```text
Create the read-only scoped hierarchy routes in `routes/hierarchy.js` and mount them in `api/index.js` on branch dev.

Models to import from `../models`:
- Province
- District
- GridSubstation
- SolarInstallation

Route Specifications (All lookup parameters are numeric IDs matching our seed data):
1. GET /provinces
   - Query all provinces from MongoDB.
   - Return HTTP 200 OK with a bare JSON array of provinces: [{ id, name, code }].

2. GET /provinces/:id
   - Find a province where `id` matches `Number(req.params.id)`.
   - If not found: return HTTP 404 with standard error body:
     {
       "error": {
         "code": "RESOURCE_NOT_FOUND",
         "message": "Province not found"
       }
     }
   - Return HTTP 200 OK with the bare object: { id, name, code }.

3. GET /provinces/:id/districts (Scoped sub-collection)
   - First check if province `Number(req.params.id)` exists; return 404 if not found using the standard error schema.
   - Query all districts where `province_id` matches `Number(req.params.id)`.
   - Return HTTP 200 OK with a bare JSON array of districts: [{ id, name, code, province_id }].

4. GET /districts
   - Query all districts from MongoDB.
   - Return HTTP 200 OK with a bare JSON array of all districts.

5. GET /districts/:id
   - Find a district where `id` matches `Number(req.params.id)`.
   - Return 404 if not found using the standard error schema.
   - Return HTTP 200 OK with the bare object: { id, name, code, province_id }.

6. GET /districts/:id/substations (Scoped sub-collection)
   - First verify district `Number(req.params.id)` exists; return 404 if not found.
   - Query all grid substations where `district_id` matches `Number(req.params.id)`.
   - Return HTTP 200 OK with a bare JSON array of substations: [{ id, name, capacity_mva, district_id }].

7. GET /substations/:id/installations (Scoped sub-collection)
   - First verify substation `Number(req.params.id)` exists; return 404 if not found.
   - Query all solar installations where `substation_id` matches `Number(req.params.id)`.
   - Ensure `api_key` remains hidden (our model toJSON handles this).
   - Return HTTP 200 OK with a bare JSON array of installations: [{ id, name, meter_id, inverter_id, substation_id, latitude, longitude, capacity_kw }].

Architecture & Implementation Rules:
- REST API Design Compliance: lowercase paths, plural collection nouns, scoped nested collections for child resources.
- Bare representation: Collections return raw arrays `[...]`, single members return raw objects `{...}` (no unnecessary envelope wrappers).
- Number conversion: Always parse incoming IDs using `Number(req.params.id)` to match the numeric IDs in MongoDB.
- Uniform Error Shape: Every 404 or 400 error must strictly adhere to `{ error: { code, message } }`.
- Export the router with `module.exports = router`.
- Mount `routes/hierarchy.js` inside `api/index.js` using `app.use('/', hierarchyRoutes)`.
```

---

## 📌 Phase 3: Operational View & Composite Resource Endpoints

```text
Create the operational view and composite resource endpoints in `routes/installations.js` and mount them in `api/index.js` on branch dev.

Models to import from `../models`:
- SolarInstallation
- GenerationReading

Helper Logic:
Create a reusable helper function `getLatestReading(installationId)`:
- Query `GenerationReading` where `installation_id` equals the numeric `installationId`.
- Sort by `timestamp` descending (-1) and limit to 1 record.
- Return the plain object or null if none exist.

Route Specifications (All use numeric :id parameters):

1. GET /installations
   - Query all solar installations from MongoDB.
   - Return HTTP 200 OK with a bare JSON array of installations (api_key excluded).

2. GET /installations/:id (WSO2 §4.3 Composite Resource)
   - Parse `id` as `Number(req.params.id)`.
   - Query `SolarInstallation` where `id` equals the numeric parameter.
   - If not found: return HTTP 404 with standard error format:
     {
       "error": {
         "code": "RESOURCE_NOT_FOUND",
         "message": "Solar installation not found"
       }
     }
   - Fetch the most recent reading using `getLatestReading(numericId)`.
   - Return HTTP 200 OK with a single composite object embedding the installation fields plus `last_reading`:
     {
       "id": 1,
       "name": "Solar Installation 001",
       "meter_id": "SLMTR-00001",
       "inverter_id": "INV-00001",
       "substation_id": 1,
       "latitude": 6.939648,
       "longitude": 79.818451,
       "capacity_kw": 8.0,
       "last_reading": {
         "id": 672,
         "installation_id": 1,
         "timestamp": "2026-09-26T23:45:00.000Z",
         "power_kw": 0.0,
         "cumulative_energy_kwh": 388.601,
         "voltage": 226.0
       } | null
     }
   - Do NOT embed an array of readings; only embed the single latest reading.

3. GET /installations/:id/readings/latest (Derived Operational View)
   - First verify the installation exists; return 404 if not found.
   - Fetch the most recent reading using `getLatestReading(numericId)`.
   - If no readings exist for this site: return HTTP 404:
     {
       "error": {
         "code": "RESOURCE_NOT_FOUND",
         "message": "No generation readings found for this installation"
       }
     }
   - Return HTTP 200 OK with the bare reading object (no metadata wrapper).

Implementation & REST Standards:
- Path naming: lowercase with hyphens (/readings/latest).
- Number conversion: Always parse `Number(req.params.id)`.
- Use standard error body shape: `{ error: { code, message } }`.
- Export router with `module.exports = router`.
- Mount `routes/installations.js` inside `api/index.js` under base path `/`.

Git Commit:
- Stage `routes/installations.js` and `api/index.js`.
- Commit with message: "add composite installation and latest reading endpoint"
- Push the commit to branch dev.
```

---

## 📌 Phase 4: Vercel Connection Troubleshooting & Auto-Repair Logic

```text
{
  "status": "operational",
  "authority": "Sri Lanka Sustainable Energy Authority",
  "version": "1.0.0",
  "database": "disconnected"
}

when check the vercel it shows
```

---

## 📌 Phase 5: Database Seeding & Local/Remote Testing Guide

```text
how i test the get metods like province
```

---

## 📌 Phase 6: Historical Generation Reading Analytical Endpoint

```text
Add the historical generation reading analytical endpoint `GET /installations/:id/readings` to `routes/installations.js` on branch dev.

Models & Libraries to use:
- SolarInstallation, GenerationReading from `../models`
- Node.js built-in `crypto` module (for MD5 hash ETag generation)

Route Specification:
GET /installations/:id/readings

1. Path Parameter Validation:
   - Convert `req.params.id` to `Number(req.params.id)`.
   - Verify that the SolarInstallation exists in MongoDB. If not found, return HTTP 404:
     {
       "error": {
         "code": "RESOURCE_NOT_FOUND",
         "message": "Solar installation not found"
       }
     }

2. Filter Support (Date Range):
   - Support optional query parameters: `from` and `to` (ISO 8601 strings, e.g. 2026-09-20T00:00:00Z).
   - Base filter: `{ installation_id: numericId }`.
   - If `from` is provided, add `$gte: new Date(req.query.from)` to the `timestamp` filter.
   - If `to` is provided, add `$lte: new Date(req.query.to)` to the `timestamp` filter.

3. Sorting Support:
   - Support `sort` (default: 'timestamp') and `order` (default: 'desc', or 'asc').
   - Sort criteria: `{ [sortField]: order === 'asc' ? 1 : -1 }`.

4. Pagination Envelope (WSO2 §10):
   - Query params: `page` (default 1), `limit` (default 50, maximum capped at 100).
   - Calculate total matching documents count using `GenerationReading.countDocuments(filter)`.
   - Construct links:
     * `next`: Full URL or query string for the next page, or null if on the last page.
     * `previous`: Full URL or query string for the previous page, or null if on page 1.
   - Execute query with `.find(filter).sort(sortObj).skip((page - 1) * limit).limit(limit).lean()`.

5. Conditional GET & ETag Implementation (WSO2 §8):
   - Prepare the response payload object:
     {
       "count": totalCount,
       "next": nextUrl,
       "previous": prevUrl,
       "data": readingsArray
     }
   - Generate a strong ETag: compute an MD5 hash of `JSON.stringify(payload)`:
     const etag = `"${crypto.createHash('md5').update(JSON.stringify(payload)).digest('hex')}"`;
   - Check incoming header: `req.headers['if-none-match']`.
   - If incoming header matches the computed `etag`:
     * Set header `ETag: etag`
     * Return HTTP 304 Not Modified with an EMPTY response body (.status(304).end()).
   - If not matched:
     * Set header `ETag: etag`
     * Set header `Cache-Control: public, max-age=60`
     * Return HTTP 200 OK with the JSON payload.

Git Commit:
- Stage `routes/installations.js`.
- Commit with message: "add history pagination, date filtering, and conditional etag get"
- Push the commit to branch dev.
```

---

## 📌 Phase 7: Upper-Band Analytical Stretch Endpoint (District Summary)

```text
Add the upper-band analytical stretch endpoint `GET /districts/:id/summary` in `routes/hierarchy.js` on branch dev.

Models to import from `../models`:
- District
- GridSubstation
- SolarInstallation
- GenerationReading

Endpoint Specification:
GET /districts/:id/summary

Requirements & Pipeline:
1. Path Parameter Validation:
   - Convert `req.params.id` to `Number(req.params.id)`.
   - Verify that the District exists. If not found, return HTTP 404 with the standard error body:
     {
       "error": {
         "code": "RESOURCE_NOT_FOUND",
         "message": "District not found"
       }
     }

2. Hierarchical Asset Resolution:
   - Find all `GridSubstation` documents where `district_id` equals the numeric district ID.
   - Extract the substation IDs.
   - Find all `SolarInstallation` documents where `substation_id` is in the list of substation IDs.
   - Extract the installation IDs.
   - Record `total_installations = installationIds.length`.
   - If no installations exist in the district, return HTTP 200:
     {
       "district_id": numericId,
       "district_name": district.name,
       "total_installations": 0,
       "current_power_kw": 0,
       "total_energy_kwh": 0,
       "peak_power_kw": 0
     }

3. Aggregation & Metrics Computation:
   - Use MongoDB aggregation on `GenerationReading` where `installation_id` is in `installationIds`:
     * current_power_kw: Sum of the single latest instantaneous power (kW) across all installations in the district (group by installation_id, sort by timestamp -1, take first power_kw, then sum).
     * total_energy_kwh: Sum of cumulative energy (latest cumulative_energy_kwh per site).
     * peak_power_kw: Maximum instantaneous power_kw ever recorded within this district.
   - Format numeric outputs cleanly to 2 decimal places using Number(val.toFixed(2)).

4. Response:
   - Return HTTP 200 OK:
     {
       "district_id": numericId,
       "district_name": district.name,
       "total_installations": total_installations,
       "current_power_kw": current_power_kw,
       "total_energy_kwh": total_energy_kwh,
       "peak_power_kw": peak_power_kw
     }

after generate and test lets commit
```

---

## 📌 Phase 8: Meter Telemetry Ingestion Write Endpoint

```text
Create the meter telemetry ingestion write endpoint `POST /installations/:id/readings` in `routes/installations.js` on branch dev.

Models & Libraries to use:
- SolarInstallation, GenerationReading from `../models`
- Node.js built-in `crypto` module (for ETag calculation)

Endpoint Specification:
POST /installations/:id/readings

Requirements & Security Pipeline:
1. Authentication (Device Ingestion Layer):
   - Extract the `X-API-Key` header from `req.headers['x-api-key']`.
   - If missing: return HTTP 401 Unauthorized with standard error format:
     {
       "error": {
         "code": "MISSING_API_KEY",
         "message": "X-API-Key header is required for device ingestion"
       }
     }

2. Installation Lookup & Key Verification:
   - Convert `req.params.id` to `Number(req.params.id)`.
   - Query `SolarInstallation.findOne({ id: numericId }).select('+api_key')`.
   - If the installation does not exist: return HTTP 404:
     {
       "error": {
         "code": "RESOURCE_NOT_FOUND",
         "message": "Solar installation not found"
       }
     }
   - Compare the provided `X-API-Key` with `installation.api_key`.
   - If they do NOT match: return HTTP 403 Forbidden:
     {
       "error": {
         "code": "INVALID_API_KEY",
         "message": "Provided API key does not match this installation"
       }
     }

3. Payload Validation:
   - Expected JSON body:
     {
       "timestamp": "2026-10-05T02:30:00Z",
       "power_kw": 4.5,
       "cumulative_energy_kwh": 395.2,
       "voltage": 231.4
     }
   - Validate that `timestamp`, `power_kw`, `cumulative_energy_kwh`, and `voltage` are provided.
   - Validate that `power_kw`, `cumulative_energy_kwh`, and `voltage` are valid non-negative numbers.
   - Validate that `new Date(timestamp)` is a valid date.
   - If validation fails: return HTTP 400 Bad Request:
     {
       "error": {
         "code": "VALIDATION_FAILED",
         "message": "Invalid reading payload fields"
       }
     }

4. Monotonic ID Assignment & Append Operation:
   - Find the highest current reading ID using `GenerationReading.findOne().sort({ id: -1 }).select('id')`.
   - Determine `nextId = (highest ? highest.id : 0) + 1`.
   - Create a new `GenerationReading` document:
     {
       id: nextId,
       installation_id: numericId,
       timestamp: new Date(req.body.timestamp),
       power_kw: Number(req.body.power_kw),
       cumulative_energy_kwh: Number(req.body.cumulative_energy_kwh),
       voltage: Number(req.body.voltage)
     }
   - Save the reading to MongoDB Atlas.

5. REST Response Compliance:
   - Compute an ETag hash of the created reading object.
   - Set the following HTTP response headers:
     * `Location: /installations/${numericId}/readings/${nextId}`
     * `ETag: "${etag}"`
     * `Last-Modified: ${new Date().toUTCString()}`
   - Return HTTP 201 Created with the bare created reading document.

Git Commit:
- Stage `routes/installations.js`.
- Commit with message: "implement device write path with x-api-key authentication"
- Push the commit to branch dev.
```

---

## 📌 Phase 9: API Key Schema Migration & Patch Script

```text
complete the api_key migration for solar installations on branch dev:

1. Update `models/SolarInstallation.js`:
   - Add the `api_key` field definition to the schema:
     api_key: {
       type: String,
       default: function() {
         return `key_inst_${this.id}`;
       },
       select: false // ensures it remains hidden on public GET collections
     }

2. Create a one-time migration script `scripts/add_api_keys.js`:
   - Connect to MongoDB Atlas using process.env.MONGO_URI.
   - Import SolarInstallation model.
   - Find all installations where api_key is missing or null:
     const installations = await SolarInstallation.find({
       $or: [{ api_key: {$exists: false } }, { api_key: null }]
     }).select('+api_key');
   - Iterate and assign:
     for (const inst of installations) {
       inst.api_key = `key_inst_${inst.id}`;
       await inst.save();
     }
   - Log: `Successfully updated ${installations.length} installations with api_keys.`
   - Disconnect cleanly from Mongoose and process.exit(0).

3. Verify `routes/installations.js`:
   - In the POST `/installations/:id/readings` endpoint, ensure the lookup includes `+api_key`:
     const installation = await SolarInstallation.findOne({ id: Number(req.params.id) }).select('+api_key');

4. Execute & Commit:
   - Run `node scripts/add_api_keys.js` in the terminal to patch the database.
   - Stage `models/SolarInstallation.js`, `routes/installations.js`, and `scripts/add_api_keys.js`.
   - Commit with message: "add api_key field to SolarInstallation and migrate existing records"
   - Push to branch dev.
```

---

## 📌 Phase 10: Jurisdiction-Scoped Authorization Middleware (RBAC)

```text
Create jurisdiction-scoped authorization middleware in `middleware/auth.js` and apply it to read routes on branch dev.

Models to import:
- User, Province, District, GridSubstation, SolarInstallation from `../models`

1. Create `middleware/auth.js`:
   Implement an `authorizeJurisdiction(resourceType)` middleware factory:
   - Identify User:
     * Extract `userId` from `req.headers['x-user-id']`.
     * If missing, allow unauthenticated read requests to pass through (or default to public/national access if testing open endpoints).
     * If provided, query `User.findOne({ id: Number(userId) })`. If user not found, return HTTP 401 Unauthorized:
       { "error": { "code": "UNAUTHORIZED", "message": "Invalid user identification" } }
   - Evaluate Role & Jurisdiction:
     * If `user.role === 'national'`: allow access (next()).
     * If `user.role === 'provincial'`:
       - If resourceType === 'province': Verify `Number(req.params.id) === user.jurisdiction_id`. If mismatched, return HTTP 403:
         { "error": { "code": "FORBIDDEN", "message": "Access denied: resource outside provincial jurisdiction" } }
       - If resourceType === 'district': Look up District `id: Number(req.params.id)`. Verify `district.province_id === user.jurisdiction_id`. If not, return 403.
     * If `user.role === 'district'`:
       - If resourceType === 'province': Return 403 (district operators have no province-level access).
       - If resourceType === 'district': Verify `Number(req.params.id) === user.jurisdiction_id`. If mismatched, return HTTP 403:
         { "error": { "code": "FORBIDDEN", "message": "Access denied: resource outside district jurisdiction" } }
       - If resourceType === 'substation': Look up GridSubstation `id: Number(req.params.id)`. Verify `substation.district_id === user.jurisdiction_id`. If not, return 403.
       - If resourceType === 'installation': Look up SolarInstallation -> GridSubstation. Verify substation's `district_id === user.jurisdiction_id`. If not, return 403.

2. Apply Middleware in Routes:
   - In `routes/hierarchy.js`:
     * Apply `authorizeJurisdiction('province')` to `GET /provinces/:id` and `GET /provinces/:id/districts`.
     * Apply `authorizeJurisdiction('district')` to `GET /districts/:id`, `GET /districts/:id/substations`, and `GET /districts/:id/summary`.
     * Apply `authorizeJurisdiction('substation')` to `GET /substations/:id/installations`.
   - In `routes/installations.js`:
     * Apply `authorizeJurisdiction('installation')` to `GET /installations/:id` and `GET /installations/:id/readings`.

3. Commit & Push:
   - Stage `middleware/auth.js`, `routes/hierarchy.js`, and `routes/installations.js`.
   - Commit with message: "implement jurisdiction-scoped rbac middleware"
   - Push to branch dev.
```

---

## 📌 Phase 11: RBAC Test User Profiles Seeding Script

```text
create and run a quick seeding script `scripts/seed_users.js` on branch dev:

1. Connect to MongoDB Atlas using `process.env.MONGO_URI`.
2. Import the `User` model from `../models`.
3. Check if test users exist. If not (or to refresh them), insert the 3 RBAC test profiles:
   await User.deleteMany({});
   await User.insertMany([
     { id: 1, username: 'national_admin', role: 'national', jurisdiction_id: null },
     { id: 2, username: 'provincial_officer', role: 'provincial', jurisdiction_id: 1 },
     { id: 3, username: 'district_operator', role: 'district', jurisdiction_id: 1 }
   ]);
4. Query and log all users:
   const users = await User.find({});
   console.log('Seeded Users in DB:', JSON.stringify(users, null, 2));
5. Disconnect cleanly and exit.

Execute `node scripts/seed_users.js` and verify that User 2 exists with `id: 2`, `role: 'provincial'`, and `jurisdiction_id: 1`.
```

---

## 📌 Phase 12: OpenAPI 3.0 Specification & Swagger UI Integration

```text
Generate an OpenAPI 3.0 specification surface and mount interactive Swagger UI in `api/index.js` on branch dev.

Objective:
Deliver an interactive, self-documenting API documentation interface at `/docs` (and raw JSON at `/docs-json`) covering all 11 previous tasks without missing asset types or query options.

Implementation Requirements:

1. Static Asset CDN Configuration for Vercel Serverless:
   - On Vercel, `swagger-ui-express` cannot serve its bundled local CSS/JS assets from disk reliably.
   - Configure `swagger-ui-express` to load assets via unpkg CDN:
     const swaggerUiOptions = {
       customCssUrl: "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css",
       customJs: [
         "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js",
         "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js"
       ]
     };

2. OpenAPI 3.0 Document Specification (`docs/openapi.json` or inline JS object):
   Define the complete OpenAPI 3.0 schema:
   - info: title: "SLSEA Solar Generation API", version: "1.0.0", description: "RESTful API for Sri Lanka Sustainable Energy Authority solar generation telemetry, geographic hierarchy, and operational analytics."
   - servers:
     * Current production URL: "https://slsea-solar-api-git-dev-diluka-theekshana-s-projects.vercel.app"
     * Local fallback: "http://localhost:3000"
   - components:
     * securitySchemes:
       - ApiKeyAuth: type: "apiKey", in: "header", name: "X-API-Key"
       - UserAuth: type: "apiKey", in: "header", name: "X-User-Id", description: "User ID for RBAC: 1 (National), 2 (Provincial - WP), 3 (District - Colombo)"
     * schemas:
       - Province: { id, name, code }
       - District: { id, name, code, province_id }
       - GridSubstation: { id, name, capacity_mva, district_id }
       - SolarInstallation: { id, name, meter_id, inverter_id, substation_id, latitude, longitude, capacity_kw }
       - GenerationReading: { id, installation_id, timestamp, power_kw, cumulative_energy_kwh, voltage }
       - DistrictSummary: { district_id, district_name, total_installations, current_power_kw, total_energy_kwh, peak_power_kw }
       - ErrorResponse: { error: { code, message } }
   - paths (Document all endpoints):
     * GET /provinces (List all 9 provinces)
     * GET /provinces/{id} (Member province lookup with X-User-Id header support)
     * GET /provinces/{id}/districts (Scoped districts under province)
     * GET /districts (List all 25 districts)
     * GET /districts/{id} (Member district lookup)
     * GET /districts/{id}/substations (Scoped substations)
     * GET /districts/{id}/summary (District generation aggregation metrics)
     * GET /substations/{id}/installations (Scoped solar installations)
     * GET /installations (List all installations)
     * GET /installations/{id} (Composite resource with last_reading)
     * GET /installations/{id}/readings/latest (Operational real-time view)
     * GET /installations/{id}/readings (Analytical history with ?page, ?limit, ?from, ?to, ?sort, ?order parameters, 200 pagination envelope, and 304 Not Modified conditional ETag support)
     * POST /installations/{id}/readings (Telemetry ingestion write path: requires X-API-Key header, validates payload, returns 201 Created with Location and ETag headers)

3. Express Mounting in `api/index.js`:
   - Serve raw spec: `app.get('/docs-json', (req, res) => res.json(swaggerDocument));`
   - Serve Swagger UI: `app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));`

4. Git Commit:
   - Stage updated files (`api/index.js`, spec definition file, `package.json`).
   - Commit with message: "integrate swagger ui and openapi 3.0 specification surface"
   - Push to branch dev.
```
