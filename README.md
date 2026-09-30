# Forms on Cloudflare Workers & D1

> **Open-Source Serverless Conversational Form Platform with Unlimited Quotas**  
> Runs 100% on Cloudflare Workers, Cloudflare D1 (Edge SQLite), and Cloudflare Static Assets. Zero containers, zero VPS, and zero external database dependencies required.

---

## Key Features

- ⚡ **100% Edge Serverless**: Runs completely on Cloudflare's global edge network (Cloudflare Workers + D1 SQLite + Static Assets).
- ♾️ **Unlimited Quotas**: Unlimited forms, submissions, storage, and team member seats for all workspaces.
- 🎨 **Clean & White-label**: Proprietary branding and badges removed for clean form embedding and sharing.
- 🔑 **Activation Code Registration**: Admin-controlled registration system (`HEY-XXXXXXXX`) without third-party email service requirements.
- 🛠️ **Interactive Form Builder**: Complete conversational form builder with rich field types, conditional logic, and custom styling.
- 📊 **Real-time Analytics & Submissions**: Submissions and response statistics stored directly in Cloudflare D1.
- 📁 **File Uploads**: Built-in file upload endpoints backed by Cloudflare R2 or direct D1 BLOB storage.

---

## Architecture

| Component | Upstream Node Stack | Cloudflare Edge Stack |
| :--- | :--- | :--- |
| **API Runtime** | NestJS (Node.js / Express) | **Cloudflare Workers** (Hono + GraphQL) |
| **Primary Database** | MongoDB (Mongoose) | **Cloudflare D1** (Serverless SQLite) |
| **Sessions & Crypto** | Redis + KeyDB + bcrypt | **Web Crypto API** (PBKDF2 + HMAC) |
| **File Storage** | AWS S3 or Local Disk | **Cloudflare R2** (or D1 fallback) |
| **Webapp / Assets** | React / Vite SPA | **Cloudflare Workers Static Assets** |

---

## Quick Start & Deployment

### Prerequisites
- Node.js >= 20
- `pnpm` >= 8
- A Cloudflare account

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/chengmatt416/forms-cloudflare-worker.git
cd forms-cloudflare-worker
pnpm install --ignore-scripts
```

### 2. Create Cloudflare D1 Database
```bash
npx wrangler d1 create heyform-db
```
Copy the generated `database_id` into `packages/worker/wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "heyform-db"
database_id = "your-actual-database-id-here"
```

### 3. Run Database Migrations
```bash
pnpm --filter @heyform/worker db:migrate:prod
```

### 4. Build and Deploy
```bash
pnpm --filter @heyform-inc/form-renderer build
pnpm --filter ./packages/webapp build
cd packages/worker && npx wrangler deploy
```

---

## License & Attribution

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.  
See the [LICENSE](./LICENSE) file for the complete terms and conditions.

This software is an independent fork of the open-source HeyForm project originally created by HeyForm Inc. and contributors. In accordance with AGPL-3.0 Section 5, Section 7(e), and Section 13, all modifications, dates, and attribution are documented in [NOTICE.md](./NOTICE.md).
