# `@relocatewise/gateway`

The **API gateway** is the third Node.js microservice in the RelocateWise GA v1.0 release (per `docs/Architecture.md` v1.4.0 §4.3 and §8).

It is a thin reverse-proxy / path-filter sitting between the public ingress (Cloudflare Tunnel) and the matching service. It does **not** own any data and does **not** run a cron; its only responsibilities are:

1. Accept public HTTPS traffic on `:3000`.
2. Apply CORS (`@fastify/cors`) and an in-process rate limit (100 req / min / IP).
3. **Refuse** any request whose URL starts with `/api/internal/` and return a 404 envelope (ITC-9 step 3).
4. Forward every other `/api/*` request to the matching service over the internal Docker network.

It is the only service that listens on the public ingress. The matching service and the ingestion service are reachable only on the internal Docker network.

## Inputs

| Env var | Required | Purpose |
|---|---|---|
| `MATCHING_URL` | Yes | Base URL of the matching service, e.g. `http://matching:3000`. |
| `PORT`, `HOST` | No | Defaults: `3000`, `0.0.0.0`. |
| `CORS_ORIGIN` | Production | Comma-separated allow-list for the Fastify CORS plugin. |
| `API_PUBLIC_SECRET` | No | Optional shared-secret gate on the public surface. When set, every request (except `/api/health`) must carry `x-relocatewise-secret: <secret>`. The matching service has the same gate — belt-and-suspenders. |
| `ENABLE_RATE_LIMIT` | No | Set to `0` to disable the in-process token-bucket (100 req/min/IP). |

## Outputs

- HTTP responses proxied from the matching service, with status + headers passed through unchanged.
- For blocked `/api/internal/*` requests: a 404 envelope (`{ error: "not_found", message: "Not found." }`). The internal endpoint is **never** reached.

## Path policy

| Pattern | Behaviour |
|---|---|
| `GET /api/health` | Forwarded. Exempt from the shared-secret gate. |
| `GET /api/cities`, `GET /api/cities/:slug` | Forwarded. |
| `POST /api/match` | Forwarded. |
| `PUT /api/internal/cities/:slug/scores` | **Refused** with 404. ITC-9 step 3. |
| Any other `/api/internal/*` | **Refused** with 404. |
| Any other `/api/*` | Refused with 404 (path not in the gateway's allow-list). |

## Directory layout

```
gateway/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── Dockerfile
├── README.md
├── src/
│   └── server.ts   # buildGateway + runGateway + CLI entrypoint
└── test/
    └── server.test.ts   # 14 tests covering ITC-9 + the proxy + auth paths
```

## Setup / test / build

```bash
npm ci
npm run -w @relocatewise/shared build
npm -w @relocatewise/gateway run typecheck
npm -w @relocatewise/gateway test
npm -w @relocatewise/gateway run build

# Local dev (gateway + matching on the same host)
MATCHING_URL=http://localhost:3000 npm -w @relocatewise/gateway run dev
```

## Known limitations

1. **No request-body buffering for `application/json`.** The gateway serialises the request body as JSON before forwarding. Multipart / streaming bodies are not supported — they would need a different transport. The matching service's API surface only uses JSON, so this is fine for GA v1.0.
2. **Shared-secret gate on the public surface.** When `API_PUBLIC_SECRET` is unset the gateway is fully transparent; the matching service's own `API_SECRET` is still enforced downstream. Both can be set independently. Cloudflare Tunnel is the primary authentication boundary — both gates are belt-and-suspenders.