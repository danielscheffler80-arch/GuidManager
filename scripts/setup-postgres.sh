#!/usr/bin/env bash
set -euo pipefail

echo "Starting PostgreSQL (Postgres) via Docker Compose..."
if command -v docker-compose >/dev/null 2>&1; then
  DC_CMD="docker-compose"
elif command -v docker >/dev/null 2>&1; then
  # Docker Compose v2 integrated as 'docker compose'
  DC_CMD="docker compose"
else
  echo "Error: docker-compose is not installed, and 'docker compose' is not available. Please install Docker Compose or use Docker's Compose v2." 
  exit 1
fi
${DC_CMD} up -d postgres

echo "Waiting for PostgreSQL to be ready..."
container=$(${DC_CMD} ps -q postgres || true)

if [ -z "$container" ]; then
  echo "Could not determine postgres container. Ensure docker-compose is configured and 'postgres' service exists."
  exit 1
fi

until docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
  echo -n ".";
done
echo "\nPostgreSQL is ready!"

echo "Next steps:"
echo "1) Configure the database URL for Prisma: backend/.env.postgres.example or your environment."
echo "2) Generate Prisma client: npm run prisma:generate (in backend)."
echo "3) Create migrations and apply them: npm run prisma:migrate (in backend)."
echo "4) (Optional) Seed initial data."
