# ⚽ Football Tunisie — Admin REST API

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
| File Uploads     | Multer                          |
| Rate Limiting    | express-rate-limit              |
| Logging          | Winston + Morgan                |

---

## 📁 Project Structure

```
football-tunisie/
├── app.js                      # Entry point — Express setup, middleware, routes
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
├── uploads/                    # Uploaded product images
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

### 5. Seed the database (optional)

```bash
npm run db:seed
```

### 6. Start the server

```bash
# Development (auto-restart on change)
npm run dev

# Production
npm start
```

---

##  Authentication

The API uses a **dual-token strategy**:

| Token         | Lifetime | Usage                        |
|---------------|----------|------------------------------|
| Access Token  | 15 min   | Sent in `Authorization: Bearer <token>` header |
| Refresh Token | 7 days   | Stored in DB, used to get a new access token   |

**Login** → receive `accessToken` + `refreshToken`  
**Refresh** → exchange old refresh token for a new access token (**rotation**)  
**Logout** → revoke current refresh token  
**Logout All** → revoke all refresh tokens for the user

---

##  API Endpoints

All routes are prefixed with `/api/admin`.

### Auth

| Method | Endpoint         | Description                  | Auth |
|--------|------------------|------------------------------|------|
| POST   | `/register`      | Create a new admin           | ❌   |
| POST   | `/login`         | Login — returns tokens       | ❌   |
| POST   | `/refresh`       | Refresh access token         | ❌   |
| POST   | `/logout`        | Logout current device        | ✅   |
| POST   | `/logout-all`    | Logout all devices           | ✅   |
| GET    | `/profil`        | Get logged-in admin profile  | ✅   |

###  Products (`/produits`)

| Method | Endpoint                         | Description               |
|--------|----------------------------------|---------------------------|
| GET    | `/getAllProduits?page=1&limit=10` | List with pagination      |
| GET    | `/getProduitById/:id`            | Get one by ID             |
| POST   | `/createProduit`                 | Create (with image upload)|
| PUT    | `/updateProduit/:id`             | Update                    |
| DELETE | `/deleteProduit/:id`             | Delete                    |
| GET    | `/verifierStock/:id/stock`       | Check stock status        |
| PATCH  | `/updateStock/:id/stock`         | Update stock quantity     |

###  Packs (`/packs`)

| Method | Endpoint                       | Description                      |
|--------|--------------------------------|----------------------------------|
| GET    | `/getAllPacks?page=1&limit=10` | List with pagination             |
| GET    | `/:id`                         | Get one by ID                    |
| POST   | `/`                            | Create pack (auto price calc)    |
| PUT    | `/:id`                         | Update pack                      |
| DELETE | `/:id`                         | Delete pack                      |

###  Offers (`/offres`)

| Method | Endpoint                        | Description               |
|--------|---------------------------------|---------------------------|
| GET    | `/getAllOffres?page=1&limit=10` | List with pagination      |
| GET    | `/:id`                          | Get one by ID             |
| POST   | `/`                             | Create offer              |
| PUT    | `/:id`                          | Update offer              |
| DELETE | `/:id`                          | Delete offer              |

###  Orders (`/commandes`)

| Method | Endpoint                           | Description                |
|--------|------------------------------------|----------------------------|
| GET    | `/getAllCommandes?page=1&limit=10` | List with pagination       |
| GET    | `/:id`                             | Get one by ID              |
| PATCH  | `/:id/statut`                      | Update order status        |
| PATCH  | `/:id/annuler`                     | Cancel an order            |
| GET    | `/:id/total`                       | Recalculate order total    |

###  Dashboard (`/dashboard`)

| Method | Endpoint        | Description                              |
|--------|-----------------|------------------------------------------|
| GET    | `/`             | Global stats (products, orders, revenue) |
| GET    | `/ventes`       | Sales stats by period (week/month/year)  |

---

##  Rate Limiting

| Limiter        | Applies to              | Limit                   |
|----------------|-------------------------|-------------------------|
| `globalLimiter`| All `/api` routes       | 100 req / 15 min per IP |
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
npm run db:seed      # Seed initial data
npm run db:studio    # Open Prisma Studio (visual DB explorer)
```

---

## 📄 License

ISC © Football Tunisie
