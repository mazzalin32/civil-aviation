# CAA Legal

Case and matter management for the Legal Department of the Uganda Civil Aviation Authority (UCAA).

- **What and why:** [PROJECT_SPEC.md](PROJECT_SPEC.md) (scope, roles, data model, security, build phases)
- **How each journey works:** [FLOWS.md](FLOWS.md)
- **Visual reference:** [docs/design/case-page.html](docs/design/case-page.html) (open in a browser)
- **Rules for contributors (and Claude Code):** [CLAUDE.md](CLAUDE.md)
- **What changed:** [CHANGELOG.md](CHANGELOG.md)

## Requirements
Node.js 24, npm, Docker Desktop.

## Run locally
```bash
cp .env.example .env          # then edit if needed — set DOCUMENT_MASTER_KEY (Phase 6)
docker compose up -d                          # Postgres + Mailpit
docker compose --profile scan up -d clamav    # virus scanning (Phase 6) — first start takes a few minutes
npm install
npm run db:migrate            # create/upgrade the database
npm run db:seed               # first Admin + sample lawyers
npm run dev                   # http://localhost:3000
```

Documents are stored encrypted on the local filesystem for now (`DOCUMENT_STORAGE_DIR`, default `./storage/documents`) — real S3-compatible object storage (the `minio` service, `--profile storage`) isn't wired up yet; see the comment above that service in `docker-compose.yml`. Without `clamav` running, set `REQUIRE_VIRUS_SCAN=false` in `.env` for local testing — every upload still records why scanning was skipped.

The seed assigns `SEED_PASSWORD` (default `CaaLegal@2026!`) to the Admin and sample lawyers and prints it after each run. Set `SEED_PASSWORD` in `.env` to use a different local/demo password. Activation links are also generated for lawyers and sent to Mailpit, but the seeded password can be used directly for local testing. Every account requires 2FA.

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Mailpit (catches dev email) | http://localhost:8026 |
| Postgres | localhost:**5460** (clear of the other local Postgres ports, 5432–5445) |

## Checks
```bash
npm run lint
npm run typecheck
npm test
```

## Full stack in Docker
```bash
docker compose --profile app up -d --build
```
