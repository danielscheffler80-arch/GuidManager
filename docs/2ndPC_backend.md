# 2ndPC Backend Plan

This document outlines the planned architecture and steps to host the backend (Node.js/Express + Prisma + PostgreSQL) on a second PC, using Docker, so the application can be accessed publicly by users.

## 1. Current App State (Context)
- Backend stack: Node.js/Express + TypeScript; Prisma ORM
- Database: PostgreSQL (running via Docker in the current repo)
- Frontend: React + TypeScript; served as SPA and via Electron desktop app
- Desktop packaging: Electron-based, loads backend and frontend dist
- Auth: Battle.net/Discord OAuth (skeleton implemented in backend)
- CI/CD: existing scripts and Docker-compose for local testing; planning for production deployment

## 2. Deployment Aim on 2nd PC
- Move backend+postgres setup to a dedicated/secondary PC (the 2nd PC)
- Keep the app accessible online, with a stable address (domain or static IP if possible)
- Maintain ability to update IP address without breaking clients (DNS/Domain based)

## 3. Architecture Options
- Option A: Cloud VM / dedicated server with static IP
  - Docker-Compose runs PostgreSQL + backend
  - Reverse proxy (Nginx/Traefik) terminates TLS via Let’s Encrypt
  - Domain (e.g. api.guildmanager.example) points to the static IP
  - Pros: stable address, predictable TLS, scalable
  - Cons: cost, administration

- Option B: Self-hosted PC with dynamic IP (DDNS)
  - Docker-Compose runs PostgreSQL + backend
  - Use DDNS to map changing IP to a domain (via Cloudflare/duckdns/noip etc.)
  - TLS via Let’s Encrypt with DNS-01 or HTTP-01 challenges
  - Pros: lower cost, straightforward for small teams
  - Cons: DNS update delay, potential downtime during IP changes

## 4. IP/DNS Strategy
- Primary approach: use a domain name rather than fixed IP
- If IP changes: update DNS A record via DDNS or DNS provider API automatically
- Backend base URL in apps: https://api.your-domain.com (ENV: BACKEND_API_BASE_URL)
- Frontend should call the domain URL, not IPs; consider a Config service if needed

## 5. Infrastructure Overview
- Docker-Compose setup on 2nd PC:
  - services: postgres (data volume), backend (node)
  - network: explicit bridge network or default; ensure ports 80/443 and 5432 (for local DB) are mapped if needed
- Reverse Proxy: Nginx or Traefik as TLS terminator
- TLS: Let’s Encrypt (auto-renewal via certbot or Traefik ACME)
- Data persistence: Docker volumes for Postgres; backup strategy for DB
- Secrets: Vault/Environment variables; no secrets in code
- Monitoring: basic logging; optional Prometheus/Grafana later

## 6. Deployment & Rollout Plan
- Phase 1: Prepare infrastructure (VM/2nd PC, DNS config)
- Phase 2: Deploy Docker-Compose stack; verify healthchecks
- Phase 3: Configure TLS/SSL; set up domain
- Phase 4: CI/CD adjustments for production (migrations on prod, seed if needed)
- Phase 5: Observability and backups

## 7. Backups & Recovery
- Regular database backups (PG dump or volume-based)
- Store backups securely (cloud storage or offsite)
- Document recovery steps

## 8. Security Considerations
- OAuth Redirect URIs for prod
- Secrets management (env vars, vault)
- TLS enforcement; port restrictions
- Access control for admin endpoints

## 9. Next Steps (checklist)
- Decide on Option A or B
- Acquire domain and set up DNS
- Prepare DDNS/Cloud DNS script or Traefik/NGINX config
- Implement TLS automation
- Migrate existing data to prod DB (if needed)
- Set up health checks and logging

## 10. Questions for Stakeholders
- Which deployment target and domain to use?
- What’s the acceptable RTO/RPO?
- Do you want a dedicated monitoring solution now or later?

End of plan.
