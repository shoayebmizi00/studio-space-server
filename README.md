# StudioSpace Server

Express + MongoDB API behind the StudioSpace studio-rental marketplace.
The Next.js client lives in the sibling `studio-space-client` folder.

Live API: https://studio-space-server.vercel.app

## Features

- **Public studio catalog** — `GET /studios` returns every published listing, newest first; `GET /studios?limit=6` returns only the newest 6 (used by the home page's *Featured* section).
- **Studio detail** — `GET /studios/:id` returns a single listing, normalized to the flat shape the client renders.
- **Listing creation** — `POST /add-studio` validates the payload and saves the listing (including gallery images) into the `studios` collection.
- **MongoDB Atlas storage** — all studios, bookings and profiles are persisted in a single `studio-space-a8` database.
- **CORS + JSON limits** — restricted to the client origin, with a friendly 413 message when uploaded images are too large.
- **Health check** — `GET /health` reports `{ ok: true }` for uptime monitoring.

## Tech stack

- Node.js + Express 5 (ESM)
- MongoDB driver 6
- dotenv + cors

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create a .env file in this folder
#    MONGODB_URI=your-mongodb-atlas-uri
#    CLIENT_URL=http://localhost:3000

# 3. Start the API on http://localhost:5000
node index.js
```

The client expects this server on `http://localhost:5000`.

## Endpoints

| Method | Path            | Purpose                                        |
| ------ | --------------- | ---------------------------------------------- |
| GET    | `/`             | Uptime banner                                  |
| GET    | `/health`       | `{ ok: true }` health check                    |
| GET    | `/studios`      | All published studios (`?limit=N` to cap)      |
| GET    | `/studios/:id`  | One studio by id                               |
| POST   | `/add-studio`   | Save a new studio listing                      |

## Examiner test credentials

Use any account you create through the client's Register page — the API
stores every studio in the shared `studio-space-a8` MongoDB database, so
the same data appears for every client session.
