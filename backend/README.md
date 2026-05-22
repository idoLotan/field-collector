# Field Collector Backend

Backend skeleton for the Field Collector app.
This backend is intentionally separate from the frontend and can be built now without connecting the frontend.

## What it provides

- `GET /api/health` — health check
- `POST /api/sign-s3` — generates an S3 presigned PUT URL for a file upload

## Setup

1. Copy `.env.example` to `.env`.
2. Set your AWS values:
   - `AWS_REGION`
   - `S3_BUCKET`
   - `CORS_ORIGIN` (the frontend origin, e.g. `http://localhost:5173`)
3. Install dependencies:

```bash
cd backend
npm install
```

4. Run the server:

```bash
npm run dev
```

## API

### GET /api/health

Returns:

```json
{ "status": "ok", "timestamp": "..." }
```

### POST /api/sign-s3

Request body:

```json
{ "filename": "file.xlsx", "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
```

Response:

```json
{
  "url": "https://...",
  "publicUrl": "https://<bucket>.s3.<region>.amazonaws.com/<key>"
}
```

## Notes

- The frontend is not connected yet.
- Later you can point the frontend to `window.S3_SIGN_URL = 'https://your-backend.example/api/sign-s3'`.
- This server only generates S3 upload links and leaves file upload to the client.
- The frontend also includes a sign picker feature for selecting road sign types when creating or editing records.
