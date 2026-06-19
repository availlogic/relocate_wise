---
title: "Integration Test Cases"
version: "1.2.0"
status: draft
author: "QA Agent / Antigravity"
created: "2026-06-10"
updated: "2026-06-19"
related_docs:
  - "docs/API_Spec.md"
  - "docs/Database.md"
---

# RelocateWise — Integration Test Cases

This document describes the backend and system integration test cases for the RelocateWise GA v1.0 release, focusing on API contracts, database operations, API gateway routing, rate-limiting layers, and system failovers.

---

## 1. API Schema & Controller Integration

#### ITC-1: Successful City Match (POST /api/match)
*   **Purpose**: Verify that the matching controller correctly parses valid inputs, queries the database, executes the sorting/weights formula, and returns exactly 10 cities.
*   **Request Method & Path**: `POST /api/match`
*   **Request Payload**:
    ```json
    {
      "climate": "mediterranean",
      "cost_importance": 3,
      "cost_ceiling": 3,
      "housing_importance": 2,
      "housing_ceiling": 4,
      "career_industry": "tech",
      "education": "important",
      "healthcare_importance": 2,
      "military_safety_importance": 3,
      "lifestyle_tags": ["urban", "coastal"]
    }
    ```
*   **Verification Steps**:
    1. Send request over HTTP to the API Gateway.
    2. Assert HTTP Status is `200 OK`.
    3. Assert response body contains a JSON object with `results` array of length exactly 10, and a `generated_at` timestamp.
    4. Assert `results[0]` has `city.slug`, `city.name`, `city.country`, `score`, `why`, `why_key`, and `why_vars`.
    5. Assert that if multiple dimensions tie (within 10%), `why_vars` contains `secondary_key` and `secondary_vars`.
    6. Assert the array is sorted in descending order of `score`.

#### ITC-2: Invalid Match Profile Validation (POST /api/match)
*   **Purpose**: Verify that Zod validation rejects invalid field types or out-of-bounds enums.
*   **Request Method & Path**: `POST /api/match`
*   **Request Payload**:
    ```json
    {
      "climate": "invalid_climate_name",
      "cost_importance": 99,
      "career_industry": 1234
    }
    ```
*   **Verification Steps**:
    1. Send request over HTTP to the API Gateway.
    2. Assert HTTP Status is `400 Bad Request`.
    3. Assert response body matches error envelope.

---

## 2. API-to-Database Contracts

#### ITC-3: DB Seeding and Schema Integrity
*   **Purpose**: Verify that running the seed script correctly truncates matching schema tables and populates cities and scores from `db/seeds/cities.json`.
*   **Preconditions**: Database container is running and has the schema loaded.
*   **Verification Steps**:
    1. Execute manual seed CLI: `npm run db:seed`.
    2. Query database: `SELECT COUNT(*)::int AS count FROM matching.cities;`.
    3. Query database: `SELECT COUNT(*)::int AS count FROM matching.city_scores;`.
*   **Expected Result**:
    *   `matching.cities` count is equal to the length of the JSON seed file.
    *   `matching.city_scores` count is exactly equal to `cities` count multiplied by 8 dimensions.

#### ITC-4: City Profile Query (GET /api/cities/:slug)
*   **Purpose**: Verify the backend joins the `matching.cities` table and the `matching.city_scores` table correctly, resolving the JSONB structures.
*   **Request Method & Path**: `GET /api/cities/lisbon-pt`
*   **Verification Steps**:
    1. Send request to the API Gateway.
    2. Assert HTTP Status is `200 OK`.
    3. Assert the returned JSON has all properties defined in `API_Spec.md` (§2.3), specifically verifying the nested `dimensions.career` and `dimensions.community` JSON objects.

---

## 3. Microservice Ingress & Schema Segregation

#### ITC-9: API Gateway Proxy Routing
*   **Purpose**: Verify that the API Gateway router routes public endpoints to backend services while blocking external access to internal endpoints.
*   **Verification Steps**:
    1. Send `POST /api/match` to API Gateway. Verify it returns `200 OK`.
    2. Send `GET /api/health` to API Gateway. Verify it returns `200 OK`.
    3. Send `PUT /api/internal/cities/lisbon-pt/scores` to the public gateway route. Verify it returns `403 Forbidden` or `404 Not Found` (gateway must block public access to internal endpoints).

#### ITC-10: Service-to-Service Contract Integrity
*   **Purpose**: Verify that the Data Ingestion Service can update Matching Service scores via the internal PUT endpoint.
*   **Verification Steps**:
    1. Send `PUT /api/internal/cities/lisbon-pt/scores` to Matching Service directly with valid Authorization header. Verify `200 OK`.
    2. Send `PUT /api/internal/cities/lisbon-pt/scores` with missing/invalid Authorization header. Verify `401 Unauthorized`.

#### ITC-11: PostgreSQL Schema-level Isolation & Privileges
*   **Purpose**: Verify that database role permissions prevent cross-schema writes.
*   **Verification Steps**:
    1. Connect to the database as the `matching_service` user role. Attempt to insert/write to `ingestion.pipeline_logs`. Verify PostgreSQL returns a permission error.
    2. Connect to the database as the `ingestion_service` user role. Attempt to write directly to `matching.city_scores`. Verify PostgreSQL returns a permission error.

---

## 4. Caching & Operations (Cloudflare Pages Proxy & Tunnel Edge Tier)

#### ITC-5: Edge Caching for Static City Profiles
*   **Purpose**: Verify that the Cloudflare edge proxy handles caching headers for GET requests.
*   **Request Method & Path**: `GET /api/cities/lisbon-pt`
*   **Verification Steps**:
    1. Send the first GET request. Inspect headers.
    2. Send second GET request within 5 seconds.
*   **Expected Result**:
    *   The backend database receives only 1 query (confirmed via SQL logs).
    *   Response headers reflect caching TTL policies.

#### ITC-6: Edge Proxy Rate Limiting
*   **Purpose**: Verify that the Cloudflare Edge WAF rate limiting blocks spam requests.
*   **Verification Steps**:
    1. Send 65 rapid requests from a single client IP address within 1 minute.
*   **Expected Result**:
    *   First 60 requests return `200 OK`.
    *   The 61st and subsequent requests return `429 Too Many Requests`.

---

## 5. Failure Recovery & Error Handling

#### ITC-7: Database Offline Error Recovery
*   **Purpose**: Verify the system behaves gracefully if the PostgreSQL server crashes or goes offline.
*   **Preconditions**: PostgreSQL docker container is stopped.
*   **Verification Steps**:
    1. Send request `GET /api/cities/lisbon-pt`.
*   **Expected Result**:
    *   Backend API Gateway and services do not crash.
    *   API returns `500 Internal Server Error` (or `503 Service Unavailable`) with standard database error JSON.

---

## 6. Background Pipeline Integration

#### ITC-8: Ingestion Pipeline Execution
*   **Purpose**: Verify that the background Ingestion Service successfully fetches raw indicator data, normalizes values, writes logs, and updates matching scores via the internal API.
*   **Preconditions**: Test database holds seed data, mock endpoints are active for primary sources.
*   **Verification Steps**:
    1. Manually trigger ingestion task via CLI: `npm run job:ingestion`.
    2. Query database for a test city (Lisbon) in `matching.city_scores` and verify that dimension scores have been updated.
    3. Query database `ingestion.pipeline_logs` and verify a success log record is written.
    4. Query database `matching.cities` table and verify `last_updated` date has been set to the current UTC date.
