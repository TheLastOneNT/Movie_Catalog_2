# Movie Catalog

A private, bilingual family movie library with synchronized ratings, viewing status, favorites, viewing dates, watch history, and notes.

## Architecture

- **Source control:** GitHub
- **Frontend:** Next.js static export
- **API:** Cloudflare Worker
- **Database:** Cloudflare D1 (SQLite)
- **Hosting:** Cloudflare Workers Static Assets
- **Access:** one shared household key stored as a secure, HTTP-only session cookie
- **Cost target:** Cloudflare Free plan

The published application does not depend on ChatGPT. GitHub remains the canonical source, and Cloudflare can automatically rebuild and deploy the site after each accepted change.

## Local development

Requirements: Node.js 22 or newer.

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run preview
```

The example access key is intentionally not committed. Replace it in `.dev.vars` before local use.

## Checks

```bash
npm run check
npx wrangler deploy --dry-run --outdir .wrangler-dry-run
```

## First production deployment

1. Create a free Cloudflare account.
2. Authenticate Wrangler with `npx wrangler login`.
3. Create the database with `npx wrangler d1 create movie-catalog-db`.
4. Copy the returned database ID into `wrangler.jsonc`.
5. Apply the schema with `npm run db:migrate:remote`.
6. Create a long household access key with `npx wrangler secret put ACCESS_KEY`.
7. Deploy with `npm run deploy`.
8. In Cloudflare Workers Builds, connect this GitHub repository to enable automatic deployments from `main`.

The free `workers.dev` address works immediately. A custom domain can be connected later without changing the application code.

## Data model

- `movies`: Russian and English metadata, category, poster, release year, and collection order.
- `movie_progress`: shared household status, 1–5 rating, favorite flag, last viewing date, watch count, and notes.
- `watch_history`: a durable record of individual viewing dates.

Schema changes are versioned in `migrations/`. Never edit an already-applied migration; add a new migration instead.

## Backups

The footer includes a JSON export. Cloudflare D1 also supports point-in-time recovery within the retention period provided by the active plan.

## Security

- Never commit `.dev.vars`, access keys, API tokens, or database credentials.
- The shared key is transmitted only over HTTPS in production and becomes an HTTP-only session cookie.
- Rotate any credential that has previously appeared in a public repository.

