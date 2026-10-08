# SLSEA Solar Generation API — Comprehensive Technical Architecture & Implementation Report

The **Sri Lanka Sustainable Energy Authority (SLSEA) Solar Generation API** is a high-performance, serverless-ready RESTful web service built with **Node.js**, **Express**, and **MongoDB Atlas (Mongoose)**. It provides real-time solar generation telemetry ingestion, geographic hierarchy management, operational composite views, historical analytical pagination, user authentication, jurisdiction-scoped Role-Based Access Control (RBAC), and interactive OpenAPI 3.0 (Swagger UI) documentation.

---

## 🏗️ System Architecture & Technology Stack

- **Runtime & Framework**: Node.js, Express.js (CommonJS)
- **Database & ODM**: MongoDB Atlas, Mongoose ODM
- **Serverless Hosting**: Vercel Serverless Functions (`@vercel/node`)
- **Authentication**:
  - **User Authentication**: User credentials login (`POST /auth/login`) returning user profile and tokens.
  - **Flexible Request Auth**: Supports `X-User-ID` header, `Authorization: Bearer <token>` header, or `user_id`/`username` query parameters (matching by numeric ID or string username).
  - **Ingestion Device Security**: Meter telemetry write ingestion protected via `X-API-Key` matching installation keys (`key_inst_${id}`).
- **Authorization**: Jurisdiction-scoped Role-Based Access Control (RBAC) enforced via `authorizeJurisdiction` middleware.
- **Performance & Caching**:
  - Serverless global Mongoose connection pooling.
  - Automatic URI escaping for special characters in database connection strings.
  - MD5 ETag caching (`304 Not Modified`) for high-volume historical GET requests.
  - CDN-backed Swagger UI static assets for serverless compatibility.

---

## 📁 Repository Directory Structure

```text
slsea-solar-api/
├── api/
│   └── index.js                 # Serverless entrypoint & route mounting
├── docs/
│   └── openapi.json             # OpenAPI 3.0 JSON specification document
├── middleware/
│   └── auth.js                  # Flexible authentication & jurisdiction RBAC middleware
├── models/
│   ├── District.js              # District Mongoose schema
│   ├── GenerationReading.js     # Telemetry GenerationReading Mongoose schema
│   ├── GridSubstation.js        # GridSubstation Mongoose schema
│   ├── Province.js              # Province Mongoose schema
│   ├── SolarInstallation.js     # SolarInstallation Mongoose schema (api_key select: false)
│   ├── User.js                  # User schema with password support (password select: false)
│   └── index.js                 # Unified models export
├── routes/
│   ├── auth.js                  # User login & authentication routes (POST /auth/login)
│   ├── hierarchy.js             # Read-only hierarchy & district analytical summary routes
│   └── installations.js         # Composite, operational, historical, and telemetry write routes
├── scripts/
│   ├── add_api_keys.js          # Migration script for installation API keys
│   ├── seed_users.js            # Seeding script for RBAC test user accounts
│   └── test_auth_guard.js       # Integration test suite verifying auth modes & RBAC
├── seed.js                      # Primary dataset seeding script (134,400+ records)
├── seed.json                    # Benchmark dataset JSON
├── vercel.json                  # Vercel serverless routing configuration
├── package.json                 # Project dependencies and npm scripts
└── PROJECT.md                   # System Architecture & Implementation Report
```

---

## 🗄️ Database Schemas & Data Model

### 1. `User` (RBAC & Authentication)
- `id` (Number, Required, Unique): Numeric user ID.
- `username` (String, Required, Unique): Login username (e.g. `national_admin`).
- `password` (String, Required): Plaintext/hashed user password.
- `name` (String): User's full display name.
- `email` (String): User's official email address.
- `role` (String, Enum: `['national', 'provincial', 'district']`, Required): User role.
- `jurisdiction_id` (Number, Nullable): Foreign key to `Province` or `District` based on role (`null` for national).
- *Transform*: Excludes `_id`, `__v`, and `password` from API JSON responses.

### 2. `Province`
- `id` (Number, Required, Unique): Province ID (1 to 9).
- `name` (String, Required): Province name (e.g. "Western Province").
- `code` (String): ISO/province code (e.g. "WP").

### 3. `District`
- `id` (Number, Required, Unique): District ID (1 to 25).
- `name` (String, Required): District name (e.g. "Colombo").
- `code` (String): District short code (e.g. "CM").
- `province_id` (Number, Required): Foreign Key $\rightarrow$ `Province`.

### 4. `GridSubstation`
- `id` (Number, Required, Unique): Substation ID.
- `name` (String, Required): Substation name.
- `capacity_mva` (Number): Total capacity in MVA.
- `district_id` (Number, Required): Foreign Key $\rightarrow$ `District`.

### 5. `SolarInstallation`
- `id` (Number, Required, Unique): Installation ID.
- `name` (String): Facility name.
- `meter_id` (String), `inverter_id` (String): Hardware serial IDs.
- `substation_id` (Number, Required): Foreign Key $\rightarrow$ `GridSubstation`.
- `latitude` (Number), `longitude` (Number): GPS coordinates.
- `capacity_kw` (Number): System capacity in kW.
- `is_deleted` (Boolean, Default: `false`): Soft delete status flag.
- `deleted_at` (Date, Default: `null`): Soft delete timestamp.
- `api_key` (String, `select: false`, Default: `key_inst_${this.id}`): Secret device ingestion key.

### 6. `GenerationReading` (Telemetry Timeseries)
- `id` (Number, Required, Unique): Monotonic reading ID.
- `installation_id` (Number, Required): Foreign Key $\rightarrow$ `SolarInstallation`.
- `timestamp` (Date, Required): Telemetry reading timestamp.
- `power_kw` (Number, Required): Instantaneous power output in kW.
- `cumulative_energy_kwh` (Number, Required): Cumulative energy generated in kWh.
- `voltage` (Number, Required): Line grid voltage.

---

## 🛣️ API Endpoints Reference

| Method | Endpoint | Description | Authentication & Security |
|---|---|---|---|
| **GET** | `/` | System health check & DB connectivity status | Public |
| **POST** | `/auth/login` | Authenticate user credentials & return user profile + token | Public |
| **GET** | `/provinces` | List all 9 Sri Lanka provinces | Auth Required (`X-User-ID` / Bearer) |
| **GET** | `/provinces/:id` | Get province details by ID | Auth Required + RBAC |
| **GET** | `/provinces/:id/districts` | List districts under a province | Auth Required + RBAC |
| **GET** | `/districts` | List all 25 districts | Auth Required (`X-User-ID` / Bearer) |
| **GET** | `/districts/:id` | Get district details by ID | Auth Required + RBAC |
| **GET** | `/districts/:id/substations` | List grid substations under a district | Auth Required + RBAC |
| **GET** | `/districts/:id/summary` | Analytical summary (current power, total energy, peak power) | Auth Required + RBAC |
| **GET** | `/substations/:id/installations` | List active solar installations under a substation | Auth Required + RBAC |
| **GET** | `/installations` | List all active solar installations (api_key omitted) | Auth Required (`X-User-ID` / Bearer) |
| **GET** | `/installations/:id` | Composite resource (installation details + `last_reading`) | Auth Required + RBAC |
| **PUT** | `/installations/:id` | Update solar installation details | Auth Required + RBAC |
| **DELETE** | `/installations/:id` | Soft delete solar installation record | Auth Required + RBAC |
| **GET** | `/installations/:id/readings/latest` | Derived real-time view (single latest reading) | Auth Required + RBAC |
| **GET** | `/installations/:id/readings` | Historical analytical view (date filter, pagination, ETag) | Auth Required + RBAC (`If-None-Match`) |
| **POST** | `/installations/:id/readings` | Meter telemetry write ingestion (returns 201 Created) | Device Auth (`X-API-Key`) |
| **GET** | `/docs` | Interactive Swagger UI documentation | Public (CDN assets) |
| **GET** | `/docs-json` | Raw OpenAPI 3.0 JSON specification | Public |

---

## 🔐 Security & Access Control Framework

### 1. User Authentication (`POST /auth/login`)
User authentication validates credentials against MongoDB `User` collection and returns:
```json
{
  "message": "Login successful",
  "token": "1",
  "x_user_id": 1,
  "user": {
    "id": 1,
    "username": "national_admin",
    "name": "National Admin",
    "email": "admin@slsea.gov.lk",
    "role": "national",
    "jurisdiction_id": null
  }
}
```

### 2. Flexible Request Authentication (`middleware/auth.js`)
All resource data GET endpoints enforce authentication. Requests are identified using any of:
- `X-User-ID: 1` or `X-User-ID: national_admin`
- `Authorization: Bearer 1` or `Authorization: Bearer national_admin`
- Query parameters `?user_id=1` or `?username=national_admin`

Unauthenticated requests are rejected with **HTTP 401 Unauthorized**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide X-User-ID or Authorization: Bearer header."
  }
}
```

### 3. Jurisdiction-Scoped RBAC Rules
- **National Role** (`role: 'national'`): Complete, unrestricted access across all Sri Lanka provinces and districts.
- **Provincial Role** (`role: 'provincial'`): Restricted strictly to assets within the user's assigned province (`jurisdiction_id`). Attempts to access other provinces return **HTTP 403 Forbidden**.
- **District Role** (`role: 'district'`): Restricted strictly to assets within the user's assigned district (`jurisdiction_id`). Blocked from province-level endpoints with **HTTP 403 Forbidden**.

### 4. Telemetry Device Security (`X-API-Key`)
Applied exclusively to `POST /installations/:id/readings`:
- Requires header `X-API-Key` matching `installation.api_key` (`key_inst_${id}`).
- Missing header $\rightarrow$ **HTTP 401 Unauthorized** (`MISSING_API_KEY`).
- Invalid key $\rightarrow$ **HTTP 403 Forbidden** (`INVALID_API_KEY`).

---

## ⚡ Interactive OpenAPI 3.0 / Swagger UI Integration

Swagger UI is hosted live at `/docs`.

- **Security Schemes Configured**:
  - `UserAuth`: `type: apiKey`, `in: header`, `name: X-User-Id`
  - `ApiKeyAuth`: `type: apiKey`, `in: header`, `name: X-API-Key`
- **Global Lock Icons (🔒)**: Every protected GET route declares `"security": [{ "UserAuth": [] }]`, enabling the green **Authorize** button in Swagger UI to automatically populate the `X-User-Id` header on all requests.

---

## 🧪 Default Test User Accounts

| Role | Username | Password | User ID / Token | Jurisdiction Scope |
|---|---|---|---|---|
| **National Admin** | `national_admin` | `Admin@123` | `1` | All Sri Lanka |
| **Provincial Officer** | `provincial_officer` | `Provincial@123` | `2` | Western Province (Province ID 1) |
| **District Operator** | `district_operator` | `District@123` | `3` | Colombo District (District ID 1) |
