# SaveABite 
<img width="80" height="80" alt="SaveABite logo" src="https://github.com/user-attachments/assets/8ff2cf7e-9fb3-4be0-a350-ac872b42d260" />


**A cross-platform mobile-first app to reduce food waste in Nepal** — connecting restaurants with surplus food to consumers at discounted prices and NGOs for donation, within a single localised platform.

> Final Year Project (FYP) : Built end-to-end: system design, database modelling, backend API, mobile app, and admin dashboard.

[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)](./LICENSE) &nbsp; © 2025 Luniva Shrestha

---

## The Problem

No existing platform in Nepal combined:
- Discounted surplus food resale from restaurants
- Automated NGO donation routing with deadline enforcement
- Donation verification with photographic proof and certificates

SaveABite bridges that gap.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo SDK 54), TypeScript |
| Backend API | Node.js, Express.js 5 |
| Database | PostgreSQL + Prisma ORM 6 |
| Auth | JWT, bcrypt, Passport.js (Google OAuth 2.0) |
| Payments | Khalti (Nepal's payment gateway) |
| Admin Panel | React 19, Vite, Tailwind CSS v4 |
| File Storage | Multer (local, `/uploads`) |
| Email | Nodemailer (Gmail SMTP) |
| Navigation | React Navigation v7 |
| Maps | react-native-maps, expo-location |

---

## Architecture

```
SaveABite/
├── Backend/                  # Node.js + Express REST API
│   ├── src/
│   │   ├── app.js            # Entry point, route wiring, OAuth setup
│   │   ├── routes/           # 10 route groups (~60+ endpoints)
│   │   ├── middleware/       # JWT auth + RBAC middleware
│   │   ├── jobs/             # Background schedulers (auto-donate, proof deadlines)
│   │   ├── services/         # Email service (Nodemailer)
│   │   └── lib/              # Prisma client singleton
│   └── prisma/
│       ├── schema.prisma     # 9 models: User, listings, reservations, donations...
│       └── migrations/       # 12 Prisma migration files
│
└── Frontend/
    ├── App.tsx               # Root navigator (31 screens, deep linking)
    ├── screens/              # 31 screens across 5 user roles
    ├── services/             # API config (axios base URL)
    ├── context/              # CartContext
    ├── components/           # Shared UI components
    └── admin-web/            # React + Vite admin dashboard (separate app)
```

---

## Features

### Multi-Role System (5 Roles)
All roles share one authentication system. Role is assigned at registration and enforced via RBAC middleware on every protected route.

| Role | Access |
|---|---|
| **Consumer** | Browse listings, cart, Khalti/COD checkout, order history, impact stats |
| **Business** | Create/manage listings, store orders, donation tracking, analytics dashboard |
| **NGO** | Browse available donations, accept donations, upload delivery proof, certificates |
| **Driver** | View/accept delivery orders, update delivery status, earnings, ratings |
| **Admin** | Full platform oversight — users, listings, donations, NGO verification, analytics |

### Food Rescue Marketplace
- Restaurants post surplus food with original price, discounted selling price, and rescue deadline
- Support for **Surprise Bags** — mystery boxes at steep discounts
- Dietary preference and health note tagging
- Stock management with transactional decrement on order confirmation

### Automated NGO Donation Routing
- Businesses toggle `auto_donate` on listings
- A background scheduler (runs every 30 seconds) checks for listings whose `rescue_deadline` has passed with remaining stock
- Automatically creates a donation record with status `available` and deactivates the listing
- NGOs see available donations and accept them

### Donation Verification Pipeline
```
available → accepted → proof_pending → verified
```
1. NGO accepts a donation
2. Restaurant marks it as picked up (starts a 24-hour proof window)
3. NGO uploads a photo of beneficiaries receiving food
4. Donation is marked `verified` — impact stats update
5. Restaurant can request a donation certificate; admin uploads PDF

### Payments
- **Khalti** (Nepal's eSewa-equivalent) — single item and cart checkout
- **Cash on Delivery** — with driver assignment flow
- Deep-link redirect back to the app after Khalti payment completes
- Payment status polling with `pidx` verification against Khalti's API

### Delivery Driver System
- Drivers browse unassigned delivery orders
- Accept → Start Ride → Mark Delivered flow
- Customer receives push notifications at each stage
- Customer rates driver after delivery (1–5 stars)

### Business Analytics Dashboard
- Orders today / this week / total
- Revenue (total and weekly)
- Surplus trend chart (7-day listing vs order counts)
- Category breakdown
- Top 5 selling items

### Admin Web Panel (React + Vite)
- Platform-wide user management (view, ban/unban, delete)
- Listings and donation oversight
- NGO application review (approve / reject with reason)
- Donation certificate upload
- Analytics: donation trend charts, top stores, top NGOs
- Computed impact stats (meals saved, kg rescued, CO₂ reduced)

### Other Features
- Google OAuth 2.0 with role selection and deep-link token handoff
- Password reset via temporary password emailed to user
- In-app push notifications (order confirmed, driver assigned, payment received, new ads)
- Advertisements system — admin uploads banner images, consumers notified
- Gamification scaffold — user points, levels, badges (user_points model in schema)
- Environmental impact tracking — bags saved → kg rescued → CO₂ reduced

---

## Database Schema (9 Models)

```
User ─────────────────────────────────────────
  id, full_name, email, phone, password
  googleId, role, isVerified, isBanned
  store_name, store_lat, store_lng, store_address
  profile_image, cover_image, identity_document

listings ─────────────────────────────────────
  store_id (→ User), item_name, category
  original_price, selling_price, stock_quantity
  is_surprise_bag, dietary_preference, health_note
  rescue_deadline, ngo_expiry, auto_donate, is_active

reservations ─────────────────────────────────
  listing_id, user_id, status, pickup_code
  order_type (pickup/delivery), delivery_lat/lng/address
  driver_id, driver_name, driver_phone, driver_rating
  payment_method (online/cod), delivered_at

donations ────────────────────────────────────
  listing_id, ngo_id, status, quantity
  accepted_at, picked_up_at, proof_deadline_at
  proof_image_url, certificate_requested, certificate_url

ngo_registrations, impact_stats,
user_points, notifications, advertisements
```

---

## API Routes (60+ endpoints)

| Prefix | Description |
|---|---|
| `POST /api/auth/signup` | Register with role selection |
| `POST /api/auth/login` | JWT login |
| `GET /api/auth/google` | Google OAuth initiation |
| `GET /api/listings/active` | Public food browse |
| `POST /api/listings/add` | Create listing (business) |
| `POST /api/payment/initiate` | Start Khalti checkout |
| `POST /api/payment/verify` | Verify payment + confirm order |
| `POST /api/payment/cod-cart` | Cash on delivery cart order |
| `GET /api/donations/available` | NGO donation feed |
| `PUT /api/donations/:id/accept` | NGO accepts donation |
| `POST /api/donations/:id/proof` | NGO uploads delivery proof |
| `GET /api/analytics/business/:storeId` | Business dashboard data |
| `GET /api/admin/dashboard` | Admin overview |
| `PUT /api/ngo/verify/:id` | Admin approves/rejects NGO |
| `GET /api/impact/global` | Platform-wide impact stats |
| `GET /api/notifications` | User notifications |
| `POST /api/ads/admin` | Admin uploads advertisement |

---

## Mobile Screens (31 total)

**Auth:** Login, Register, ForgotPassword, ResetPassword

**Consumer:** UserHomepage, FoodDetail, StoreDetail, Cart, MyOrders, UserProfile, Notifications, PaymentVerify

**Business:** BusinessDashboard, BusinessAddListing, ManageListings, EditListing, StoreOrders, StoreDonations, AnalyticsDashboard, BusinessSettings, SetStoreLocation

**NGO:** NGOHomepage, NGORegistration

**Driver:** DriverDashboard, DriverProfile, DeliveryTracking, EarningsHistory

**Admin (mobile):** AdminNGOVerify, AdminCertificates

---

## Running Locally

> This project was developed on macOS with local + ngrok environments. Full cloud deployment is not configured.

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm install -g pm2
- A Khalti sandbox account (for payment testing)
- A Google Cloud project with OAuth 2.0 credentials

---

### 1. Clone the repo

```bash
git clone https://github.com/onikasbarbz/SaveABite.git
cd SaveABite
```

---

### 2. Backend setup

```bash
cd Backend
npm install
```

Create a `.env` file in `Backend/`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_pg_user
DB_PASSWORD=your_pg_password
DB_NAME=saveabite_app
DATABASE_URL="postgresql://your_pg_user:your_pg_password@localhost:5432/saveabite_app?schema=public"

# Server
PORT=5000
JWT_SECRET=your_random_secret_key_here

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Email (Gmail with App Password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# Mobile deep link
CLIENT_URL_SCHEME=saveabite://

# Khalti (use sandbox key from khalti.com/developer)
KHALTI_SECRET_KEY=your_khalti_test_secret_key
KHALTI_RETURN_URL=http://localhost:5000/api/payment/return
```

Run database migrations:

```bash
# Create the database first in psql:
# CREATE DATABASE saveabite_app;

npx prisma migrate deploy
npx prisma generate
```

---

### 3. Mobile app setup

```bash
cd Frontend
npm install
```

In `Frontend/services/apiConfig.ts`, update `BASE_URL` to point to your backend:

```ts
// For Android emulator
export const BASE_URL = "http://10.0.2.2:5000";

// For physical device (use your machine's local IP)
export const BASE_URL = "http://192.168.x.x:5000";

// For ngrok tunnel (recommended for OAuth and Khalti callbacks)
export const BASE_URL = "https://your-ngrok-url.ngrok-free.app";
```

#### Choose how to run the app

**Option A — Physical device (easiest)**
1. Install [Expo Go](https://expo.dev/go) from the Play Store (Android) or App Store (iOS)
2. Make sure your phone and laptop are on the **same WiFi network**
3. Find your machine's local IP:
   - Mac/Linux: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: run `ipconfig` → look for **IPv4 Address**
4. Set `BASE_URL` to that IP (e.g. `http://192.168.1.5:5000`)

**Option B — Android emulator**
1. Install [Android Studio](https://developer.android.com/studio)
2. Open **Virtual Device Manager** → Create Device (Pixel 6, API 33+ recommended)
3. Start the emulator and wait for it to fully boot
4. Set `BASE_URL` to `http://10.0.2.2:5000`

**Option C — iOS simulator (Mac only)**
1. Install [Xcode](https://developer.apple.com/xcode/) from the Mac App Store
2. Open Xcode once to accept the license and finish setup
3. Set `BASE_URL` to `http://localhost:5000`

Start the Expo dev server:

```bash
npx expo start
```

| Environment | What to do |
|---|---|
| Physical device | Scan the QR code with the Expo Go app |
| Android emulator | Press `a` (emulator must already be running) |
| iOS simulator | Press `i` (Mac only) |

---

### 4. Admin web setup (optional)

```bash
cd Frontend/admin-web
npm install
npm run dev
```

Opens at `http://localhost:5173`. Log in with an account that has `role: admin`.

To create an admin account, either update a user's role directly in the database or add a seed in `prisma/seed.js`.

---

### 5. Using ngrok (for OAuth and Khalti)

Google OAuth callbacks and Khalti's payment return URL need a public HTTPS URL. Use ngrok to expose your local backend:

```bash
ngrok http 5000
```

Update `GOOGLE_CALLBACK_URL` and `KHALTI_RETURN_URL` in your `.env` to use the ngrok URL, and update `BASE_URL` in the mobile app.

---

### 6. Running the project 

Once setup is complete, these are the commands to start everything:

```bash
# 1. Start PostgreSQL
brew services start postgresql@14

# 2. Start the backend (keeps it running in the background)
cd Backend
pm2 start npm -- run dev

# 3. Check backend is running
pm2 status

# 4. Expose backend publicly (needed for OAuth + Khalti)
ngrok http 5000

# 5. Start the mobile app
cd Frontend
npx expo start --tunnel -c
```

**To stop everything:**

```bash
pm2 stop npm
brew services stop postgresql@14
```

> `pm2` keeps the backend alive in the background so closing your terminal won't kill it. `--tunnel` means your phone doesn't need to be on the same WiFi as your laptop. `-c` clears the Expo cache.

---

## Notes for Reviewers

- This is a Final Year Project — production deployment is not configured, but all core logic is complete and functional.
- Khalti integration uses sandbox credentials; real payments are not processed.
- Google OAuth is configured for development; the callback URL needs updating for any deployed environment.
- Full system documentation (SRS, UML diagrams — use case, sequence, class, activity, communication — ERD, and wireframes) will be uploaded to this repo.
- The `prisma/migrations/` folder contains 12 incremental migration files documenting the full schema evolution across the project.

---

## System Documentation

Project reports and full design documentation (SRS, UML, ERD, wireframes) will be added to a `/docs` folder in this repository.

---


## Artefact (Graphical representation of system)

<img width="1450" height="838" alt="image" src="https://github.com/user-attachments/assets/d9100501-2f50-4ebb-b713-063885d2b6bb" />

---

## Author

Built by Luniva Shrestha as a Final Year Project.  
<!-- Add your LinkedIn and portfolio links here before pushing -->
