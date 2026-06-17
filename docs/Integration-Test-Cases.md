---
title: "Integration Test Cases"
version: "1.0.0"
status: draft
author: "QA Agent"
created: "2026-06-10"
updated: "2026-06-10"
related_docs:
  - "docs/API_Spec.md"
  - "docs/Database.md"
---

# RelocateWise — Integration Test Cases

This document describes the backend and system integration test cases for the RelocateWise MVP, focusing on API contracts, database operations, caching proxy behavior, rate-limiting layers, and system failovers.

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
      "lifestyle_tags": ["urban", "coastal"]
    }
    ```
*   **Verification Steps**:
    1. Send request over HTTP to the backend server.
    2. Assert HTTP Status is `200 OK`.
    3. Assert the response body contains a JSON object with `results` array of length exactly 10, and a `generated_at` timestamp.
    4. Assert `results[0]` has `city.slug`, `city.name`, `city.country`, `score` (integer between 0 and 100), and `why` (non-empty string).
    5. Assert the array is sorted in descending order of `score`.

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
    1. Send request over HTTP to backend server.
    2. Assert HTTP Status is `400 Bad Request`.
    3. Assert response body matches error envelope:
       ```json
       {
         "error": "invalid_profile",
         "message": "The request body is not a valid UserProfile.",
         "details": [ ... ]
       }
       ```

---

## 2. API-to-Database Contracts

#### ITC-3: DB Seeding and Schema Integrity
*   **Purpose**: Verify that running the seed script correctly truncates all data and populates cities and their corresponding dimensional scores from `db/seeds/cities.json`.
*   **Preconditions**: Database container is running and has the schema loaded.
*   **Verification Steps**:
    1. Execute manual seed CLI: `npm run db:seed`.
    2. Query database: `SELECT COUNT(*)::int AS count FROM cities;`.
    3. Query database: `SELECT COUNT(*)::int AS count FROM city_scores;`.
*   **Expected Result**:
    *   `cities` count is equal to the length of the JSON seed file (e.g., 40).
    *   `city_scores` count is exactly equal to `cities` count multiplied by the number of dimensions (e.g., $40 \times 8 = 320$).

#### ITC-4: City Profile Query (GET /api/cities/:slug)
*   **Purpose**: Verify the backend joins the `cities` table and the `city_scores` table correctly, resolving the JSONB structures.
*   **Request Method & Path**: `GET /api/cities/lisbon-pt`
*   **Verification Steps**:
    1. Send request.
    2. Assert HTTP Status is `200 OK`.
    3. Assert the returned JSON has all properties defined in `API_Spec.md` (§2.3), specifically verifying the nested `dimensions.career` and `dimensions.community` JSON objects.

---

## 3. Caching & Operations (Netlify Proxy & Edge Tier)

#### ITC-5: Edge Caching for Static City Profiles
*   **Purpose**: Verify that the Netlify function proxy handles caching headers for GET requests.
*   **Request Method & Path**: `GET /api/cities/lisbon-pt` (sent via Proxy function)
*   **Verification Steps**:
    1. Send the first GET request. Inspect the headers.
    2. Send the second GET request within 5 seconds.
*   **Expected Result**:
    *   The backend database receives only 1 query (confirmed via SQL logs).
    *   Response headers reflect caching TTL policies.

#### ITC-6: Edge Proxy Rate Limiting
*   **Purpose**: Verify that the Netlify Proxy blocks spam requests.
*   **Verification Steps**:
    1. Send 65 rapid requests from a single client IP address within 1 minute.
*   **Expected Result**:
    *   First 60 requests return `200 OK`.
    *   The 61st and subsequent requests return `429 Too Many Requests`.

---

## 4. Failure Recovery & Error Handling

#### ITC-7: Database Offline Error Recovery
*   **Purpose**: Verify the system behaves gracefully if the PostgreSQL server crashes or goes offline.
*   **Preconditions**: PostgreSQL docker container is stopped.
*   **Verification Steps**:
    1. Send request `GET /api/cities/lisbon-pt`.
*   **Expected Result**:
    *   Backend Node server does not crash.
    *   API returns `500 Internal Server Error` (or `503 Service Unavailable`) with a standard JSON error envelope:
       ```json
       {
         "error": "database_error",
         "message": "Database connection failed."
       }
       ```
