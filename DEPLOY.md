# Deployment guide - how the three projects fit together

```
 Back office (React)  ─┐   HTTPS                    ┌── MySQL
  ballons-tunisie-backoffice ├──── nginx /api/... ──►  API ────┤
 Store (React)         ─┘                           └── Cloudinary (product images)
  ballons-tunisie-frontoffice
```

The three repositories must sit side by side:

```
ballons-tunisie-api/            (this repository, contains docker-compose.yml)
ballons-tunisie-frontoffice/
ballons-tunisie-backoffice/
```

## With Docker (recommended)

1. **Configuration** - on the server, in this folder:
   ```bash
   cp .env.production.example .env.production
   ```
   Fill in every value: database passwords, `JWT_SECRET` (32+ characters), the public HTTPS
   addresses of the store and the back office in `FRONTEND_URL`, `TRUST_PROXY`, the Cloudinary
   keys, and the first admin account (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`).
   Docker refuses to start while a required value is missing.

2. **Start** - MySQL, the API, the store and the back office:
   ```bash
   docker compose --env-file .env.production up -d --build
   ```
   The tables are created when the API starts. Store: port 8080, back office: port 8081.
   The API (port 3000) is only reachable from the server itself: both front ends call it
   through their own nginx (`/api/...`), so `VITE_API_URL` stays empty.

3. **First admin account** - creates this account only, never touches the other data:
   ```bash
   docker compose --env-file .env.production exec api npm run admin:create
   ```
   Then log in to the back office, change the password from the profile page and remove
   `SEED_ADMIN_PASSWORD` from `.env.production`. Other admins are created from the back office.

4. **HTTPS** - put a reverse proxy (or the host's load balancer) with certificates in front of
   ports 8080 and 8081, for example `www.` for the store and `admin.` for the back office.
   With such a proxy, set `TRUST_PROXY=2` (otherwise every visitor shares one rate limit).

5. **Updates** - `git pull` in the three folders, then the same `up -d --build` command.
   Data is kept in the `db-data` Docker volume; product images are on Cloudinary.

**Never run `npm run db:seed` in production**: it is the demo seed used for client
validation, it empties the database. It refuses to run when `NODE_ENV=production`.

## Without Docker

1. **MySQL** - create a database and a user, put its URL in `DATABASE_URL`.
2. **API** - copy `.env.example` -> `.env`, set `NODE_ENV=production` and fill `DATABASE_URL`,
   `JWT_SECRET`, `FRONTEND_URL`, `TRUST_PROXY`, `CLOUDINARY_*` (with a production
   `CLOUDINARY_FOLDER`), `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, then:
   `npm ci --omit=dev && npx prisma db push && npm run admin:create && npm start`
3. **Back office / Store** - set `VITE_API_URL` to the API's public URL (or leave it empty
   behind a proxy that forwards `/api`), `npm run build`, serve `dist/`. The web server must
   send `index.html` for unknown paths (see each project's `nginx.conf`) and, for the back
   office, accept request bodies up to 30 MB on `/api` (5 images of 5 MB per product).
4. **CORS** - put the exact public origins of both front ends in the API's `FRONTEND_URL` (comma-separated).

## Checks

- Delivery fee: `FRAIS_LIVRAISON` in the store's `src/config.js` must equal the one in the API's `utils/commande.js`.
- Store contact details (phone, e-mail, social networks): `src/config.js` of the store.
- Cloudinary images: `npm run images:list` lists the images of `CLOUDINARY_FOLDER` and the ones no product uses.
