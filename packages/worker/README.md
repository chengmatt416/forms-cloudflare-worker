# HeyForm on Cloudflare Workers

This package is a serverless fork of the HeyForm backend, re-architected to run 100% on **Cloudflare Workers**, **Cloudflare D1**, and **Cloudflare Static Assets**.

---

## Architecture Overview

| Component | Standard HeyForm | Cloudflare Worker Fork |
| :--- | :--- | :--- |
| **API Server** | NestJS (Node.js / Express) | Cloudflare Worker (Hono + GraphQL) |
| **Database** | MongoDB (Mongoose) | **Cloudflare D1** (Edge SQLite) |
| **Sessions & Crypto** | Redis + KeyDB + bcrypt | **Web Crypto API** (PBKDF2 + HMAC) |
| **File Storage** | AWS S3 or Local Disk | **Cloudflare R2** (or D1 fallback) |
| **Webapp / Frontend** | React / Vite SPA on Node server | **Cloudflare Worker Static Assets** |

---

## Getting Started

### 1. Prerequisites
- Node.js >= 20
- `pnpm` >= 8
- A Cloudflare account (free tier works)

### 2. Local Development

1. **Install dependencies**:
   ```bash
   pnpm install --ignore-scripts
   ```

2. **Initialize Local D1 Database**:
   ```bash
   pnpm --filter @heyform/worker db:migrate:local
   ```

3. **Start the Local Development Server**:
   ```bash
   pnpm dev:worker
   ```
   The local Worker and GraphQL API will be running at `http://localhost:8787`.

---

## Deploying to Cloudflare

### 1. Create your Cloudflare D1 Database
Run the following command in your terminal:
```bash
npx wrangler d1 create heyform-db
```

This will output something like:
```toml
[[d1_databases]]
binding = "DB"
database_name = "heyform-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. Update `packages/worker/wrangler.toml`
Open `packages/worker/wrangler.toml` and replace `database_id` with your generated ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "heyform-db"
database_id = "your-actual-database-id-here"
```

Also generate a secure 32+ character random string for `SESSION_SECRET`:
```toml
[vars]
SESSION_SECRET = "your-random-32-char-secret-key"
APP_DISABLE_REGISTRATION = "false"
```

### 3. Run Remote D1 Migrations
Apply the database schema to your live Cloudflare D1 database:
```bash
pnpm --filter @heyform/worker db:migrate:prod
```

### 4. Build Webapp & Deploy to Cloudflare
```bash
pnpm deploy:worker
```

Wrangler will compile the React web application and deploy your entire HeyForm instance (frontend assets + serverless GraphQL Worker) to your Cloudflare `*.workers.dev` subdomain or custom domain!

---

## Features Supported on Cloudflare Workers
- Full GraphQL API (`/graphql`) compatible with HeyForm Webapp
- User registration and password authentication using PBKDF2 Web Crypto
- Workspaces, Projects, and Form creation / customization
- Form sharing and conversational answering (`/form/:formId`)
- Form submissions collection and reporting in D1
- File uploads via `/api/upload` (backed by R2 or D1)
- Zero VPS or container hosting required
