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
cp .env.example .env          # then edit if needed
docker compose up -d          # Postgres + Mailpit (storage and ClamAV profiles join in Phase 6)
npm install
npm run db:migrate            # create/upgrade the database
npm run db:seed               # first Admin + sample lawyers
npm run dev                   # http://localhost:3000
```

Until login exists (Phase 1), a **Dev preview** switch in the sidebar shows the Admin or Lawyer shell.

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Mailpit (catches dev email) | http://localhost:8025 |
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
