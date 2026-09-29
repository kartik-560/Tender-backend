# AI-Powered Tender & RFP Intelligence Platform - Backend API Documentation

## Base URL
`http://localhost:5000/api`

---

## 1. Authentication
### `POST /api/auth/register`
Create a new user account.
**Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePassword123!",
  "role": "Bid Manager"
}
```

### `POST /api/auth/login`
Authenticate with email and password to retrieve a JWT token.
**Request Body**:
```json
{
  "email": "alex.vance@bidintel.ai",
  "password": "password123"
}
```

### `GET /api/auth/me`
Retrieve currently authenticated profile. Requires `Authorization: Bearer <token>`.

---

## 2. Tender Processing & Ingestion
### `POST /api/tenders/upload`
Upload a PDF tender/RFP. Parses the PDF, calls Google Gemini AI to analyze key requirements, deadlines, and risk score out of 5.0, and stores the tender in the database.
- **Content-Type**: `multipart/form-data`
- **Field**: `document` (File, .pdf)

**Response**:
```json
{
  "success": true,
  "data": {
    "tender": {
      "id": "tnd-172589...",
      "title": "Smart Traffic Management RFP",
      "riskScore": 3.8,
      "documentUrl": "https://...",
      "requirements": [...],
      "tasks": [...]
    },
    "rawAnalysis": { ... }
  }
}
```

### `GET /api/tenders`
List all ingested tenders with requirement counts and AI risk scores.

### `GET /api/tenders/:id`
Fetch single tender details, compliance clauses, and timeline tasks.

---

## 3. Analytics
### `GET /api/analytics`
Fetch aggregate platform KPIs:
- 24 Active Tenders
- 7 Upcoming Deadlines
- 62% Win Rate
- 3.8 Avg AI Risk Score
- Monthly Tender Analysis (Jan - Sep trend)
- Win vs Loss ratio breakdown
