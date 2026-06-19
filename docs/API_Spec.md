# RelocateWise — API Specification

This document describes the REST API surface for the RelocateWise General Availability (GA) v1.0 release. 

The base URL is `/api` in production (served via Cloudflare Pages edge proxy rules and Caddy/API Gateway) and matches `http://localhost:3000` in development.

---

## 1. Global API Standards

- **Content Type**: All request and response bodies must use `application/json`.
- **Authentication**: Public endpoints require no authentication. Internal endpoints require a pre-shared secret key or local-network access boundaries.
- **Error Response Shape**: All API errors return a standard JSON envelope:
  ```json
  {
    "error": "error_code",
    "message": "Human-readable explanation of what went wrong"
  }
  ```

---

## 2. API Routes

### 2.1 Health Check
Verify the service is running and query the version info.

- **URL**: `GET /api/health`
- **Response Code**: `200 OK`
- **Response Body**:
  ```json
  {
    "ok": true,
    "version": "1.0.0"
  }
  ```

---

### 2.2 List Cities
Retrieve a lightweight summary list of all available cities in the dataset.

- **URL**: `GET /api/cities`
- **Response Code**: `200 OK`
- **Response Body**:
  ```json
  {
    "cities": [
      {
        "slug": "new-york-us",
        "name": "New York City",
        "country": "United States",
        "country_code": "US",
        "region": "North America",
        "lat": 40.7128,
        "lng": -74.006,
        "description": "The financial and cultural capital of the U.S."
      }
    ]
  }
  ```

---

### 2.3 Get City Profile
Retrieve the complete profile for a single city by its unique slug identifier, including all 8 dimension scores.

- **URL**: `GET /api/cities/:slug`
- **URL Parameter**: `slug` (string, e.g., `lisbon-pt`)
- **Success Response Code**: `200 OK`
- **Success Response Body**:
  ```json
  {
    "slug": "lisbon-pt",
    "name": "Lisbon",
    "country": "Portugal",
    "country_code": "PT",
    "region": "Europe",
    "lat": 38.7223,
    "lng": -9.1393,
    "description": "Atlantic-coast capital that has become Europe's leading digital-nomad hub...",
    "last_updated": "2026-01-15",
    "dimensions": {
      "climate": {
        "label": "Mediterranean"
      },
      "cost": 4,
      "housing": 4,
      "career": {
        "tech": 2,
        "finance": 1,
        "healthcare": 1,
        "creative": 2,
        "manufacturing": 1
      },
      "education": 4,
      "healthcare": 4,
      "community": {
        "urban": 2,
        "suburban": 1,
        "coastal": 3,
        "mountain": 0,
        "arts_culture": 2,
        "family_oriented": 1,
        "expat_friendly": 3
      },
      "military_safety": 5
    }
  }
  ```
- **Error Response Code**: `404 Not Found` (if slug does not exist)
- **Error Response Body**:
  ```json
  {
    "error": "city_not_found",
    "message": "No city with slug \"unknown-slug\""
  }
  ```

---

### 2.4 Match Cities
Submit the user's questionnaire choices to run the deterministic matching engine and return the top 10 ranked cities.

- **URL**: `POST /api/match`
- **Request Body (Zod Validated)**:
  All fields are optional or nullable. If omitted, documented defaults (weights = 0) are automatically applied.
  
| Field | Type | Allowed Values | Description |
|---|---|---|---|
| `climate` | string | `tropical`, `temperate`, `mediterranean`, `continental`, `cold`, `arid`, `no_preference` | Preferred climate label |
| `cost_importance` | integer | `0` (None), `1` (Low), `2` (Medium), `3` (High) | Importance of cost index |
| `cost_ceiling` | integer | `1`, `2`, `3`, `4`, `5`, `null` | Max allowed cost score (lower = cheaper) |
| `housing_importance` | integer | `0`, `1`, `2`, `3` | Importance of housing index |
| `housing_ceiling` | integer | `1`, `2`, `3`, `4`, `5`, `null` | Max allowed housing score (lower = cheaper) |
| `career_industry` | string/null | `tech`, `finance`, `healthcare`, `creative`, `manufacturing`, `null` | User's industry cluster |
| `education` | string | `important`, `somewhat`, `not_relevant` | Priority for education quality |
| `healthcare_importance`| integer | `0`, `1`, `2`, `3` | Importance of healthcare index |
| `military_safety_importance`| integer | `0`, `1`, `2`, `3` | Importance of Geopolitical and Conflict Risk |
| `lifestyle_tags` | array of strings | `urban`, `suburban`, `coastal`, `mountain`, `arts_culture`, `family_oriented`, `expat_friendly` | Preferred community vibe tags |

- **Request Body Example**:
  ```json
  {
    "climate": "mediterranean",
    "cost_importance": 3,
    "cost_ceiling": 3,
    "housing_importance": 3,
    "housing_ceiling": 3,
    "career_industry": "tech",
    "education": "important",
    "healthcare_importance": 2,
    "military_safety_importance": 3,
    "lifestyle_tags": ["urban", "coastal"]
  }
  ```
- **Success Response Code**: `200 OK`
- **Success Response Body**:
  Returns the top 10 cities matching the criteria, sorted in descending order of overall match score (0–100). Each result includes localization keys (`why_key` and `why_vars`) to translate matches client-side.
  ```json
  {
    "results": [
      {
        "city": {
          "slug": "lisbon-pt",
          "name": "Lisbon",
          "country": "Portugal",
          "country_code": "PT",
          "region": "Europe",
          "lat": 38.7223,
          "lng": -9.1393,
          "description": "Atlantic-coast capital that has become Europe's leading digital-nomad hub...",
          "dimensions": { ... }
        },
        "score": 87,
        "why": "Matches your Mediterranean climate preference and strong tech job market",
        "why_key": "climate",
        "why_vars": {
          "climate": "mediterranean",
          "secondary_key": "career",
          "secondary_vars": {
            "industry": "tech"
          }
        }
      }
    ],
    "generated_at": "2026-06-10T06:47:34Z"
  }
  ```
- **Error Response Code**: `400 Bad Request` (if request body validation fails against Zod schema)

---

### 2.5 Update City Scores (Internal API)
Allows the Data Ingestion Service to push newly compiled scores into the Matching Service.

- **URL**: `PUT /api/internal/cities/:slug/scores`
- **URL Parameter**: `slug` (string, e.g., `lisbon-pt`)
- **Headers**: `Authorization: Bearer <secret_key>`
- **Request Body**:
  ```json
  {
    "dimensions": {
      "climate": {
        "label": "Mediterranean"
      },
      "cost": 4,
      "housing": 4,
      "career": {
        "tech": 2,
        "finance": 1,
        "healthcare": 1,
        "creative": 2,
        "manufacturing": 1
      },
      "education": 4,
      "healthcare": 4,
      "community": {
        "urban": 2,
        "suburban": 1,
        "coastal": 3,
        "mountain": 0,
        "arts_culture": 2,
        "family_oriented": 1,
        "expat_friendly": 3
      },
      "military_safety": 5
    }
  }
  ```
- **Success Response Code**: `200 OK`
- **Success Response Body**:
  ```json
  {
    "success": true,
    "message": "Scores updated for city lisbon-pt"
  }
  ```
- **Error Response Code**: `401 Unauthorized` (if API key is missing or invalid) or `404 Not Found` (if city slug is invalid)

---

## 3. Operational Policies

### 3.1 Caching (Cloudflare Edge Tier)
To protect the backend server from traffic spikes, Cloudflare edge proxy tier caching is applied:
- **`GET /api/cities/:slug`**: Cached at the edge for **60 seconds** (TTL).
- **`GET /api/cities`**: Cached at the edge for **60 seconds** (TTL).
- **`POST /api/match`**: Dynamic questionnaire matching requests are **never** cached.
- **`PUT /api/internal/*`**: Internal management requests bypass edge caching.

### 3.2 Rate Limiting
Rate limiting is applied at two independent tiers:
1. **Edge Tier (Cloudflare WAF)**: Public requests are rate limited to **60 requests per 10 minutes** per client IP address. Exceeding this rate returns a standard `429 Too Many Requests` status code.
2. **Backend Server Tier (API Gateway)**: Utilizes a token-bucket algorithm configured to allow up to **100 requests per minute** per IP address. Internal requests from trusted services bypass gateway limits.
