# Ledge — Inventory

A single-file inventory management app connected to [CartRover / Extensiv Integration Manager](https://developers.cartrover.com/) via a serverless AWS backend.

## Features

- **Dashboard** — overview stats and activity feed
- **Inventory** — item list with detail panel, pricing, and stock levels
- **Purchase Orders** — track open and closed POs
- **Manufacturing** — work orders with BOM and progress tracking
- **Suppliers** — vendor list and contact info
- **Responsive** — works on desktop, tablet, and mobile

## Stack

- **Frontend** — single `inventory-app.html` file, no build step
- **Backend** — AWS Lambda + API Gateway (Node.js), deployed via Serverless Framework
- **Data** — CartRover / Extensiv Integration Manager API

---

## Setup

### 1. Deploy the backend

```bash
cd backend
npm install
npm install -g serverless

# Configure AWS credentials (one-time)
serverless config credentials --provider aws --key YOUR_KEY --secret YOUR_SECRET

# Add CartRover credentials
cp .env.example .env
# Edit .env and fill in CARTROVER_USER and CARTROVER_KEY

# Deploy
npm run deploy
```

After deploying, Serverless will print an API Gateway URL like:
```
https://abc123.execute-api.us-east-1.amazonaws.com
```

### 2. Connect the frontend

Open `inventory-app.html` and set the `API_BASE` constant at the top of the `<script>` block:

```js
const API_BASE = 'https://abc123.execute-api.us-east-1.amazonaws.com';
```

### 3. Open the app

Open `inventory-app.html` in any modern browser. Navigate to Inventory, Orders, or Shipping — data will load from CartRover automatically.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/products` | Product catalogue |
| GET | `/inventory` | Inventory levels |
| GET | `/orders` | All orders |
| GET | `/orders/{id}` | Single order |
| PUT | `/orders/{id}` | Update order status |
| GET | `/shipments` | Shipped order tracking |

---

## CartRover Credentials

Find your API credentials in CartRover: **Merchants → API keys**

Store them in `backend/.env` (never committed to git):
```
CARTROVER_USER=your_api_user
CARTROVER_KEY=your_api_key
```
