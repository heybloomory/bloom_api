# bloom_api (from zero)

## Quick start
1) Copy env:
```bash
cp .env.example .env
```
2) Install:
```bash
npm i
```
3) Run:
```bash
npm run dev
```
4) Health:
GET http://localhost:<PORT>/health

## Flutter (bloom_app) notes
- Android emulator base URL: `http://10.0.2.2:<PORT>`
- iOS simulator / macOS / Windows: `http://localhost:<PORT>`

The current Flutter app in your repo calls these auth endpoints:
- GET  `/api/auth/check-country`
- POST `/api/auth/send-otp` (demo placeholder until SMS provider is integrated)
- POST `/api/auth/login-email`

## Core routes
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/login-email
- POST /api/auth/send-otp
- GET  /api/auth/check-country
- GET  /api/auth/me
- PATCH /api/users/me

- POST /api/memories
- GET  /api/memories
- GET  /api/memories/:id
- PATCH /api/memories/:id
- DELETE /api/memories/:id

- POST /api/albums
- GET  /api/albums
- GET  /api/albums/:id
- PATCH /api/albums/:id
- DELETE /api/albums/:id

- POST /api/media
- GET  /api/media?albumId=...
- DELETE /api/media/:id

All protected endpoints require:
Authorization: Bearer <token>


## BunnyCDN Upload (Albums)

Set these in `.env`:
- `BUNNY_STORAGE_ZONE`
- `BUNNY_STORAGE_KEY`
- `BUNNY_CDN_BASE_URL` (your Pull Zone base URL)

Upload endpoint:
- `POST /api/media/upload` (multipart/form-data) with fields `albumId` and `file`

Album hierarchy:
- Root albums: `GET /api/albums` (defaults to `parentId=null`)
- Child albums: `GET /api/albums?parentId=<albumId>`
- Album details incl. children + media: `GET /api/albums/:id`
