# Deployment guide - how the three projects fit together

```
 Back office (React)  ─┐
  Ballons_Tunisie_Admin │   HTTPS /api/...        ┌── MySQL
                        ├──────────────►  API ────┤
 Store (React)         ─┘  ballons-tunisie-api     └── Cloudinary (product images)
  Ballons_Tunisie_Store
```

1. **MySQL** - create a database, put its URL in `DATABASE_URL`.
2. **API** - copy `.env.example` -> `.env`, fill `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CLOUDINARY_*`.
   `npm install && npx prisma db push && npm run db:seed && npm start`
3. **Back office / Store** - set `VITE_API_URL` to the API's public URL, `npm run build`, serve `dist/`.
   (Same-domain setups behind nginx can leave it empty, see the store's `nginx.conf`.)
4. **CORS** - put the exact public origins of both front ends in the API's `FRONTEND_URL` (comma-separated).
5. **Docker** - `docker compose up --build` starts MySQL + API + store (port 8080). Put `CLOUDINARY_*` in a `.env` beside `docker-compose.yml`.
   The compose file expects the store repo in `../ballons-tunisie-frontoffice`; adjust `build:` if your folder is named differently.
6. Delivery fee: `FRAIS_LIVRAISON` in the store's `src/config.js` must equal the one in the API's `utils/commande.js`.
