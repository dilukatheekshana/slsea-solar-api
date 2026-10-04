# SLSEA Solar Generation API — Project Architecture & Implementation Guide

The **Sri Lanka Sustainable Energy Authority (SLSEA) Solar Generation API** is a high-performance, serverless-ready RESTful web service built with **Node.js**, **Express**, and **MongoDB Atlas (Mongoose)**. It provides real-time telemetry ingestion, geographic hierarchy management, operational composite views, historical analytical pagination, jurisdiction-scoped RBAC authorization, and interactive OpenAPI 3.0 documentation.

---

## 🏗️ System Architecture & Stack

- **Runtime & Framework**: Node.js, Express.js (CommonJS)
- **Database & ODM**: MongoDB Atlas, Mongoose ODM
- **Serverless Hosting**: Vercel Serverless Functions (`@vercel/node`)
- **Security**: Ingestion Device `X-API-Key` Authentication, Jurisdiction-Scoped `X-User-Id` RBAC Middleware
- **Performance & Reliability**:
  - Global Mongoose connection pooling across serverless invocations.
  - Automatic URI escaping for special characters in database passwords (`#` $\rightarrow$ `%23`).
  - Strong MD5 ETag caching (`304 Not Modified`) for high-volume historical GET requests.
  - CDN-backed Swagger UI static assets for serverless compatibility.

---

## 📁 Repository Directory Structure

```
slsea-solar-api/
├── api/
│   └── index.js                 # Serverless entrypoint & route mounting
├── docs/
│   └── openapi.json             # OpenAPI 3.0 JSON specification document
├── middleware/
│   └── auth.js                  # Jurisdiction-scoped RBAC authorization middleware
├── models/
│   ├── District.js              # District Mongoose schema
│   ├── GenerationReading.js     # Telemetry GenerationReading Mongoose schema
│   ├── GridSubstation.js        # GridSubstation Mongoose schema
│   ├── Province.js              # Province Mongoose schema
│   ├── SolarInstallation.js     # SolarInstallation Mongoose schema (hidden api_key)
│   ├── User.js                  # User RBAC Mongoose schema
│   └── index.js                 # Unified models export
├── routes/
│   ├── hierarchy.js             # Read-only hierarchy & district analytical summary routes
│   └── installations.js         # Composite, operational, historical, and write routes
├── scripts/
│   ├── add_api_keys.js          # One-time migration script for installation API keys
│   └── seed_users.js            # Seeding script for RBAC test user profiles
├── seed.js                      # Primary dataset seeding script (134,400+ records)
├── seed.json                    # Raw benchmark dataset
├── vercel.json                  # Vercel serverless routing configuration
├── package.json                 # Project dependencies and lifecycle scripts
└── README.md                    # Baseline documentation
```

---

## 🗄️ Database Schemas & Data Model

### 1. `Province`
- `id` (Number, Unique)
- `name` (String)
- `code` (String, Optional)

### 2. `District`
- `id` (Number, Unique)
- `name` (String)
- `code` (String, Optional)
- `province_id` (Number, Foreign Key $\rightarrow$ Province)

### 3. `GridSubstation`
- `id` (Number, Unique)
- `name` (String)
- `capacity_mva` (Number)
- `district_id` (Number, Foreign Key $\rightarrow$ District)

### 4. `SolarInstallation`
- `id` (Number, Unique)
- `name` (String)
- `meter_id` (String)
- `inverter_id` (String)
- `substation_id` (Number, Foreign Key $\rightarrow$ GridSubstation)
- `latitude` (Number), `longitude` (Number)
- `capacity_kw` (Number)
- `api_key` (String, `select: false`, Default: `key_inst_${this.id}`)

### 5. `GenerationReading`
- `id` (Number, Unique)
- `installation_id` (Number, Foreign Key $\rightarrow$ SolarInstallation)
- `timestamp` (Date)
- `power_kw` (Number)
- `cumulative_energy_kwh` (Number)
- `voltage` (Number)

### 6. `User`
- `id` (Number, Unique)
- `username` (String), `name` (String), `email` (String)
- `role` (`'national'`, `'provincial'`, `'district'`)
- `jurisdiction_id` (Number, Nullable)

---

## 🛣️ API Endpoints Summary

| Method | Endpoint | Description | Security / Headers |
|---|---|---|---|
| **GET** | `/` | Operational status & database connectivity health check | Public |
| **GET** | `/provinces` | List all 9 provinces | Public |
| **GET** | `/provinces/:id` | Get province details by ID | `X-User-Id` (RBAC) |
| **GET** | `/provinces/:id/districts` | List districts under a province | `X-User-Id` (RBAC) |
| **GET** | `/districts` | List all 25 districts | Public |
| **GET** | `/districts/:id` | Get district details by ID | `X-User-Id` (RBAC) |
| **GET** | `/districts/:id/substations` | List grid substations under a district | `X-User-Id` (RBAC) |
| **GET** | `/districts/:id/summary` | Analytical summary (current power, energy, peak power) | `X-User-Id` (RBAC) |
| **GET** | `/substations/:id/installations` | List solar installations under a substation | `X-User-Id` (RBAC) |
| **GET** | `/installations` | List all solar installations | Public |
| **GET** | `/installations/:id` | Composite resource (installation details + `last_reading`) | `X-User-Id` (RBAC) |
| **GET** | `/installations/:id/readings/latest` | Derived real-time view (single latest reading) | Public |
| **GET** | `/installations/:id/readings` | Analytical history (date filter, pagination, sorting, ETag) | `X-User-Id`, `If-None-Match` |
| **POST** | `/installations/:id/readings` | Meter telemetry write ingestion (returns 201 Created) | `X-API-Key` |
| **GET** | `/docs` | Interactive Swagger UI documentation | Public (CDN assets) |
| **GET** | `/docs-json` | Raw OpenAPI 3.0 JSON specification | Public |

---

## 🔐 Security & Access Control

### 1. Ingestion Device Security (`X-API-Key`)
- Applied to `POST /installations/:id/readings`.
- Requires header `X-API-Key` matching `installation.api_key` (`key_inst_${id}`).
- Missing header $\rightarrow$ **HTTP 401 Unauthorized** (`MISSING_API_KEY`).
- Mismatched key $\rightarrow$ **HTTP 403 Forbidden** (`INVALID_API_KEY`).

### 2. Jurisdiction-Scoped RBAC (`X-User-Id`)
- Middleware in `middleware/auth.js` (`authorizeJurisdiction(resourceType)`).
- **National Role** (`role: 'national'`): Access to all geographic scopes.
- **Provincial Role** (`role: 'provincial'`): Restricted to assets within `user.jurisdiction_id` (Province).
- **District Role** (`role: 'district'`): Restricted to assets within `user.jurisdiction_id` (District); blocked from province-level endpoints.
- Unauthenticated requests (no `X-User-Id`) pass through for public accessibility.

---

## ⚡ Performance Features & Optimization

1. **Serverless Connection Pooling**: Caches Mongoose connections globally across Vercel lambda invocations.
2. **Conditional GET & ETag Caching**: Computes MD5 hash on `GET /installations/:id/readings`. Matches `If-None-Match` header to return **HTTP 304 Not Modified** with zero payload bytes.
3. **MongoDB Aggregation Pipelines**: High-speed calculation of instantaneous power, cumulative energy, and historical peak power on `GET /districts/:id/summary`.
