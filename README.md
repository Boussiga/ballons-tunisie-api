# Football Tunisie - Admin REST API

A secure and fully-featured REST API for managing a Tunisian football e-commerce platform. Built with **Express.js**, **Prisma ORM** and **MySQL**.

---

##  Tech Stack

| Layer            | Technology                      |
|------------------|---------------------------------|
| Runtime          | Node.js v22                     |
| Framework        | Express.js v5                   |
| ORM              | Prisma v5 + MySQL               |
| Authentication   | JWT (Access Token + Refresh Token) |
| Validation       | Zod v4                          |
| File Uploads     | Multer (memory) -> Cloudinary    |
| Rate Limiting    | express-rate-limit              |
| Logging          | Winston + Morgan                |

---

## Project Structure

```
football-tunisie/
├── app.js                      # Entry point - Express setup, middleware, routes
├── config/
│   ├── prisma.js               # Prisma client singleton
│   └── rateLimiter.js          # Global, auth, upload and read limiters
├── controller/
│   ├── admin.auth.controller.js
│   ├── admin.produit.controller.js
│   ├── admin.pack.controller.js
│   ├── admin.offre.controller.js
│   ├── admin.commande.controller.js
│   └── admin.dashboard.controller.js
├── middelwhere/
│   └── auth.middleware.js       # JWT verification middleware
├── router/
│   ├── admin.auth.router.js
│   ├── admin.produit.router.js
│   ├── admin.pack.router.js
│   ├── admin.offre.router.js
│   ├── admin.commande.router.js
│   └── admin.dashboard.router.js
├── validations/
│   ├── validate.middleware.js   # Generic Zod middleware
│   ├── auth.validation.js
│   ├── produit.validation.js
│   ├── pack.validation.js
│   ├── offre.validation.js
│   └── commande.validation.js
├── utils/
│   └── logger.js               # Winston logger
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.js                 # Seed script
├── .env                        # Environment variables (not committed)
└── .env.example                # Environment variable template
```

---

##  Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/football-tunisie.git
cd football-tunisie
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Then edit `.env` with your own values:

```env
DATABASE_URL="mysql://user:password@localhost:3306/football_db_name"
JWT_SECRET="your_very_secret_key_here"
PORT=3000
```

### 4. Sync the database

```bash
npx prisma db push
```

### 5. Load the demo data (development only)

```bash
npm run db:seed
```

Demo data for client validation sessions: it **empties the database** first, and refuses to run when `NODE_ENV=production`. To create only the first admin account (production), use `npm run admin:create`.

### 6. Start the server

```bash
# Development (auto-restart on change)
npm run dev

# Production
npm start
```

### 7. Tests

```bash
npm test               # Jest unit tests, Prisma mocked (no database needed)
npm run test:coverage
```

---

##  Docker

`docker-compose.yml` is the production stack: MySQL, the API, the store (`../ballons-tunisie-frontoffice`)
and the back office (`../ballons-tunisie-backoffice`), the three repositories side by side.

```bash
cp .env.production.example .env.production                                    # then fill in every value
docker compose --env-file .env.production up -d --build                       # start everything
docker compose --env-file .env.production exec api npm run admin:create       # first admin account
docker compose --env-file .env.production down                                # stop
```

- Store: port 8080, back office: port 8081 (put HTTPS in front). The API is only reachable from the server: both front ends call it through their nginx.
- Docker refuses to start while a required value of `.env.production` is missing.
- The tables are created automatically when the API starts (`prisma db push`), the database is kept in the `db-data` volume, product images are on Cloudinary.
- Full procedure: [DEPLOY.md](DEPLOY.md).

---

##  Authentication

The API uses a **dual-token strategy**:

| Token         | Lifetime | Usage                        |
|---------------|----------|------------------------------|
| Access Token  | 15 min   | Sent in `Authorization: Bearer <token>` header |
| Refresh Token | 7 days   | Stored in DB, used to get a new access token   |

**Login** -> receive `accessToken` + `refreshToken`  
**Refresh** -> exchange old refresh token for a new access token (**rotation**)  
**Logout** -> revoke current refresh token  
**Logout All** -> revoke all refresh tokens for the user

---

##  API Endpoints

All routes are prefixed with `/api/admin`.

### Auth

| Method | Endpoint         | Description                  | Auth |
|--------|------------------|------------------------------|------|
| POST   | `/register`      | Create a new admin           | No   |
| POST   | `/login`         | Login - returns tokens       | No   |
| POST   | `/refresh`       | Refresh access token         | No   |
| POST   | `/logout`        | Logout current device        | Yes  |
| POST   | `/logout-all`    | Logout all devices           | Yes  |
| GET    | `/profil`        | Get logged-in admin profile  | Yes  |

###  Products (`/produits`)

| Method | Endpoint                         | Description               |
|--------|----------------------------------|---------------------------|
| GET    | `/getAllProduits?page=1&limit=10` | List with pagination      |
| GET    | `/getProduitById/:id`            | Get one by ID             |
| POST   | `/createProduit`                 | Create, with up to 5 images |
| PUT    | `/updateProduit/:id`             | Update, add images to the gallery |
| DELETE | `/deleteProduit/:id`             | Delete (and its images)   |
| DELETE | `/deleteImage/:id/images/:imageId` | Remove one image from the gallery |
| PATCH  | `/setImagePrincipale/:id/images/:imageId` | Make an image the main image |
| GET    | `/verifierStock/:id/stock`       | Check stock status        |
| PATCH  | `/updateStock/:id/stock`         | Update stock quantity     |

#### Product images

A product has a gallery of **up to 5 images** (JPG, PNG or WebP, 5 MB max each), stored on Cloudinary.

- `createProduit` / `updateProduit` accept multipart files in the `images` field (several files allowed). On update they are added after the current images; the request is refused if the gallery would exceed 5 images.
- The `image` field (single file) replaces the main image.
- The first image is the main one: it is also returned as `imageUrl`, used by the store lists, packs, offers and order tracking.
- Products return `images: [{ id, url, ordre }]`, main image first. The store product page returns `images: [{ id, url }]`.

###  Packs (`/packs`)

| Method | Endpoint                         | Description                   |
|--------|----------------------------------|-------------------------------|
| GET    | `/getAllPacks?page=1&limit=10`   | List with pagination          |
| GET    | `/getPackById/:id`               | Get one by ID                 |
| POST   | `/createPack`                    | Create pack (price = products - `pourcentageRemise` %) |
| PUT    | `/updatePack/:id`                | Update pack (products and/or `pourcentageRemise`) |
| DELETE | `/deletePack/:id`                | Delete pack                   |

###  Offers (`/offres`)

| Method | Endpoint                         | Description          |
|--------|----------------------------------|----------------------|
| GET    | `/getAllOffres?page=1&limit=10&produitId=` | List with pagination, filter by product |
| GET    | `/getOffreById/:id`              | Get one by ID        |
| POST   | `/createOffre`                   | Create offer for the selected products (`produitIds`) |
| PUT    | `/updateOffre/:id`               | Update offer (`produitIds` replaces the selection) |
| DELETE | `/deleteOffre/:id`               | Delete offer         |

###  Orders (`/commandes`)

| Method | Endpoint                               | Description             |
|--------|----------------------------------------|-------------------------|
| GET    | `/getAllCommandes?page=1&limit=10`     | List with pagination    |
| GET    | `/getCommandeById/:id`                 | Get one by ID           |
| GET    | `/calculerTotal/:id/total`             | Recalculate order total |
| PATCH  | `/updateStatutCommande/:id/statut`     | Update order status     |
| PATCH  | `/annulerCommande/:id/annuler`         | Cancel an order         |

Every new order (store or admin) carries a flat **10 TND delivery fee** (`fraisLivraison`, set in `utils/commande.js`).
`total` is what the client pays: items after offers + `fraisLivraison`. Orders placed before the fee existed keep `fraisLivraison = 0`.

###  Dashboard (`/dashboard`)

| Method | Endpoint                        | Description                              |
|--------|---------------------------------|------------------------------------------|
| GET    | `/getDashboard`                 | Global stats (products, orders, revenue) |
| GET    | `/getStatistiquesVentes/ventes` | Sales stats by period (week/month/year)  |
| GET    | `/getStatistiquesDetaillees?dateDebut=&dateFin=&granularite=` | Detailed business statistics (see below) |

#### Detailed statistics - `/getStatistiquesDetaillees`

| Parameter     | Format                        | Default                                   |
|---------------|-------------------------------|-------------------------------------------|
| `dateDebut`   | `AAAA-MM-JJ`                  | 29 days before `dateFin`                  |
| `dateFin`     | `AAAA-MM-JJ` (included)       | today                                     |
| `granularite` | `jour` | `semaine` | `mois` | auto: ≤ 31 days -> jour, ≤ 6 months -> semaine, else mois |

Revenue counts every order that is not `annulee`. Every figure is compared with the previous period of the same length.

| Section              | Content |
|----------------------|---------|
| `resume`             | Revenue (total, delivered, in progress, lost to cancellations), orders, average basket, items sold, discounts granted, cancellation / delivery rates, unique customers |
| `comparaison`        | Current vs. previous period with variation in % (`null` when the previous value is 0) |
| `commandesParStatut` | Count and amount per status |
| `evolution`          | Time series per day / week / month (empty periods included) for charts |
| `produits`           | Top 10 by revenue and by quantity |
| `categories`         | Revenue and share per category (packs grouped under "Packs") |
| `packs` / `offres`   | Sales per pack, usage and discount cost per offer |
| `clients`            | New / returning / loyal customers (identified by phone), top 10 customers |
| `regions`            | Revenue per governorate, detected from the delivery address |
| `habitudes`          | Orders per weekday and per hour |
| `stock`              | Stock value, out of stock, low stock, products at risk of running out (< 14 days at current pace), unsold products and tied-up value |
| `alertes`            | Points needing attention (orders pending > 48h, out of stock, revenue drop, high cancellation rate…) |

---

##  Rate Limiting

| Limiter        | Applies to              | Limit                   |
|----------------|-------------------------|-------------------------|
| `globalLimiter`| Public `/api` routes (store) | 40 req / 30 s per IP |
| `adminLimiter` | `/api/admin`, `/api/auth` | 120 req / 1 min per IP |
| `authLimiter`  | `/login`, `/refresh`    | 10 req / 15 min per IP  |
| `uploadLimiter`| POST/PUT with files     | 20 req / 15 min per IP  |
| `readLimiter`  | GET list endpoints      | 60 req / 1 min per IP   |

---

##  Pagination

All `GET` list endpoints support the following query parameters:

| Parameter | Type   | Default | Description              |
|-----------|--------|---------|--------------------------|
| `page`    | number | `1`     | Page number              |
| `limit`   | number | `10`    | Number of items per page |

**Response format:**
```json
{
  "data": [...],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---


##  Database Scripts

```bash
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Demo data for client validation (empties the database, refused in production)
npm run admin:create # Create the first admin account only (safe in production)
npm run db:studio    # Open Prisma Studio (visual DB explorer)
```

---

## License

ISC © Football Tunisie
