# AWS Low-Cost Production Deploy

This is the cheapest production shape that still keeps the app smooth enough for an early launch:

- `app.savjax.com` -> Next.js web container
- `api.savjax.com` -> NestJS API container
- PostgreSQL -> local Docker container on the same server
- uploads -> Docker volume on the same server disk
- TLS + reverse proxy -> Caddy
- compute -> one Amazon Lightsail Linux instance

## Why this shape

The repo already includes an ECS + Amplify path, but that is not low budget once ALB, Fargate, RDS, EFS, and Amplify are all running together.

For this codebase, the best low-cost path is one small Lightsail server with Docker Compose:

- cheaper
- faster to set up
- simple to operate
- easy to upgrade later

## Recommended size

Use Lightsail `small_3_1` first:

- 2 GB RAM
- 2 vCPUs
- 60 GB SSD
- 1.5 TB transfer

AWS currently lists that bundle at `$12/month` with a public IPv4 address. If you want more headroom later, `medium_3_1` is 4 GB RAM and `$24/month`.

Reference:

- https://aws.amazon.com/lightsail/pricing/

## Important current-state note

AWS account inspection on April 6, 2026 found:

- an existing Lightsail instance named `savjax_web`
- bundle `nano_3_1` with only `0.5 GB` RAM
- `savjax.com` and `www.savjax.com` currently point to that server
- `api.savjax.com` does not exist yet
- domain DNS is not in Route 53; nameservers are `ns1.dns-parking.com` and `ns2.dns-parking.com`

That means the safest low-cost rollout is:

1. keep the current marketing website untouched
2. create a new Lightsail app server
3. deploy this repo there
4. add `app.savjax.com` and `api.savjax.com` DNS records at the current DNS provider

## Provision a fresh app server

```bash
aws lightsail create-instances \
  --region ap-south-1 \
  --instance-names savjax-app-prod \
  --availability-zone ap-south-1a \
  --blueprint-id ubuntu_24_04 \
  --bundle-id small_3_1

aws lightsail allocate-static-ip \
  --region ap-south-1 \
  --static-ip-name savjax-app-prod-ip

aws lightsail attach-static-ip \
  --region ap-south-1 \
  --static-ip-name savjax-app-prod-ip \
  --instance-name savjax-app-prod
```

Open ports `80`, `443`, and `22`.

## Server bootstrap

After first SSH login:

```bash
bash infra/aws/lightsail-bootstrap.sh
```

That installs Docker, Docker Compose, and a 2 GB swap file so builds stay more stable on a small server.

## Runtime files

Use:

- `infra/aws/docker-compose.lightsail.yml`
- `infra/aws/Caddyfile`
- `infra/aws/lightsail.env.example`

Create a real env file on the server:

```bash
cp infra/aws/lightsail.env.example /etc/nexid/lightsail.env
```

Then replace every placeholder secret before starting containers.

## Launch

From the repo root on the server:

```bash
sudo docker compose --env-file /etc/nexid/lightsail.env -f infra/aws/docker-compose.lightsail.yml up -d db
sudo docker compose --env-file /etc/nexid/lightsail.env -f infra/aws/docker-compose.lightsail.yml run --rm api npm run migrate:deploy
sudo docker compose --env-file /etc/nexid/lightsail.env -f infra/aws/docker-compose.lightsail.yml up -d --build
```

Create the first admin after the API is healthy:

```bash
sudo docker compose --env-file /etc/nexid/lightsail.env -f infra/aws/docker-compose.lightsail.yml run --rm \
  -e ADMIN_EMAIL='sales@savjax.com' \
  -e ADMIN_PASSWORD='replace-this-now' \
  -e ADMIN_NAME='Main Admin' \
  api npm run create:super-admin
```

## DNS you still need outside AWS

Because the domain is not managed in Route 53, add these records where `savjax.com` DNS is currently hosted:

- `app` -> A -> new Lightsail static IP
- `api` -> A -> new Lightsail static IP

Caddy will issue HTTPS certificates automatically after those records resolve to the new server.

## Backup note

This layout is intentionally budget-first. The tradeoff is that the app, database, and uploads all live on one server disk.

For minimum protection, take Lightsail snapshots before major deploys and on a regular schedule.
