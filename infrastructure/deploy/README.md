# Production deployment

[PROPOSED] Continuous deployment of `main` to the production VPS. Pending approval from endy-rkt, who approves workflow and deployment changes ([AGENTS.md](../../AGENTS.md#ci)).

## How it works

```text
push to main ─► CI (ci.yml) green ─► deploy-prod.yml
                                       ├─ build: 6 images → ghcr.io/<owner>/lova-<image>:<commit>
                                       └─ deploy: ssh (restricted key) → ssh-gate.sh → deploy.sh
browser ─► https://<domain> ─► host reverse proxy (TLS) ─► 127.0.0.1:3300 web (nginx)
                                                             ├─ /      → frontend bundle
                                                             └─ /api/* → gateway → services
```

- [PROPOSED] [deploy-prod.yml](../../.github/workflows/deploy-prod.yml) starts when the CI run of a `main` push succeeds. It builds `auth`, `gateway`, `content`, `nft`, `lidar` and `web` from their Dockerfiles (`runtime` target) and tags them with the commit SHA. Nothing is built on the server.
- [PROPOSED] The `deploy` job uses the `production` environment. Its SSH key can only run [ssh-gate.sh](ssh-gate.sh), which accepts `deploy <commit>`, checks the commit out in `~/lova` and runs [deploy.sh](deploy.sh). The GHCR token travels on stdin and is logged out after the pull.
- [PROPOSED] `deploy.sh` pulls the images, restarts the stack with [compose.prod.yml](compose.prod.yml), waits for `gateway` and `web` to be healthy and rolls back to the previous tag otherwise. It keeps only the current and previous LOVA images on disk.
- [PROPOSED] `web` is the only published container, on `127.0.0.1:3300`. It serves the frontend ([Dockerfile](../../apps/frontend/Dockerfile), [nginx.conf](../../apps/frontend/nginx.conf)) and relays `/api` to the gateway, so the browser keeps one origin (D06). The gateway port is not published in production.
- [PROPOSED] Every container logs to rotated files (3 × 10 MB).

## Rollback

Run **Deploy production** by hand (Actions → Deploy production → Run workflow) with the commit to restore in `sha`. Images that exist in GHCR are redeployed without a rebuild. On the server, `.env` keeps `LOVA_IMAGE_TAG` and `LOVA_PREVIOUS_IMAGE_TAG`.

## GitHub settings

- Environment `production`, deployment branches limited to `main`. Add required reviewers to approve each deploy by hand.
- Environment secrets: `PROD_SSH_KEY` (private deploy key), `PROD_SSH_KNOWN_HOSTS` (the server's `ssh-keyscan -t ed25519` line, checked against its fingerprint), optional `DISCORD_WEBHOOK_URL`.
- Environment variables: `PROD_HOST`, `PROD_USER`, `LOVA_DOMAIN` (host name only, no scheme).
- The workflow requests `packages: write` for the build and `packages: read` for the deploy. The default workflow permissions stay read-only.

## DNS

One `A` record for `LOVA_DOMAIN` pointing to the VPS address. Remove any `AAAA` record on the same name, and allow `letsencrypt.org` if the zone has `CAA` records. The reverse proxy obtains the certificate once the name resolves.

## Server bootstrap

Done once, as the deploy user. The server is shared with other projects: LOVA only adds `~/lova`, one site block in the shared reverse proxy and one `authorized_keys` line.

1. Clone the public repository: `git clone --depth 1 https://github.com/songomby-D1/devfest2026.git ~/lova`.
2. Create the runtime files with the pinned Node image, so the server needs no Node install:
   `docker run --rm -u "$(id -u):$(id -g)" -v ~/lova:/repo -w /repo node:22.23.5-slim node scripts/setup/init-env.mjs`.
3. Add the production keys to `~/lova/.env`:

   | Key                          | Value                                                               |
   | ---------------------------- | ------------------------------------------------------------------- |
   | `COMPOSE_FILE`               | `docker-compose.yml:infrastructure/deploy/compose.prod.yml`         |
   | `LOVA_REGISTRY`              | `ghcr.io/<owner in lowercase>`                                      |
   | `LOVA_DOMAIN`                | The public host name                                                |
   | `LOVA_WEB_PORT`              | `3300`, or any free loopback port                                   |
   | `AUTH_RATE_LIMIT_PER_MINUTE` | See the open point on client addresses below                        |
   | `COMPOSE_PROFILES`           | `local-chain` only with the local chain, with `DEMO_CHAIN_MNEMONIC` |

4. Fill `~/lova/apps/backend/nft/.env` with the NFT owner's network, contract, minter key and IPFS settings. `NODE_ENV=production` forbids the `fake` IPFS driver.
5. Install the gate outside the checkout and allow the deploy key to run it only:
   `install -D -m 755 ~/lova/infrastructure/deploy/ssh-gate.sh ~/.local/bin/lova-ssh-gate`, then append to `~/.ssh/authorized_keys`:
   `restrict,command="/home/debian/.local/bin/lova-ssh-gate" ssh-ed25519 AAAA… lova-github-actions-deploy`.
6. Add the site to the host reverse proxy (Caddy here), then validate and reload it:

   ```caddyfile
   <domain> {
   	encode zstd gzip
   	reverse_proxy 127.0.0.1:3300
   }
   ```

7. With the local chain only (Anvil; the contract needs Cancun, which the demo's Ganache lacks):
   - Generate the gallery wallet once: `docker run --rm --entrypoint anvil ghcr.io/foundry-rs/foundry:stable --mnemonic-random --accounts 1` prints a mnemonic and its first private key. Store the mnemonic as `DEMO_CHAIN_MNEMONIC` in `.env` and the key as `MINTER_PRIVATE_KEY` in `apps/backend/nft/.env`, with `CHAIN_RPC_URL=http://chain:8545` and `CHAIN_ID=31337`.
   - Start the chain and deploy the contract from inside the Compose network, which writes `CONTRACT_ADDRESS` into `apps/backend/nft/.env`: `docker compose up -d chain`, then
     `docker run --rm -u "$(id -u):$(id -g)" --network lova_internal_net -e CHAIN_URL=http://chain:8545 -v ~/lova:/repo -w /repo node:22.23.5-slim node scripts/demo/deploy-contract.mjs`, then `docker compose up -d nft-service`.
8. Before the first CI deploy only, the images can be built once on the server with `LOVA_IMAGE_TAG` set to the checked-out commit: `docker compose build`, then `docker compose up -d`. The build sections of `compose.prod.yml` exist for this step. Later deploys pull from GHCR.

## Current server

[CONFIRMED] Bootstrapped on 2026-11-22 from `develop` at `4cf9172`, with the images built on the server (step 8) because `main` has no release yet.

- Host: the shared VPS behind Caddy, site `lova.forastech.duckdns.org` on `127.0.0.1:3300`. DuckDNS resolves any name under `forastech.duckdns.org` to the VPS, so no DNS change was needed.
- NFT: the opt-in local chain (`COMPOSE_PROFILES=local-chain`, Anvil, chain 31337, fake IPFS driver). Mint and on-chain verification pass. No public blockchain is involved yet, so the explorer and IPFS links shown on a certificate lead nowhere until the public test network is configured.
- Content: the five public-domain works of `scripts/demo/items.json`, seeded with `seed.mjs` (images fetched on the server with a User-Agent that names the repository, because Wikimedia answers 429 to the generic one of `fetch-media.mjs`).

## Operations

Run from `~/lova` on the server. `COMPOSE_FILE` in `.env` selects both files.

- Status: `docker compose ps`. Logs: `docker compose logs -f gateway web`.
- Redeploy the current tag by hand: `docker compose up -d --no-build`.
- Data lives in the `lova_postgres-data`, `lova_seaweedfs-data`, `lova_media` and `lova_chain-data` volumes. Back them up before any `docker compose down -v`.

## Open points

- [DECISION REQUIRED: endy-rkt] The gateway rate-limits login and registration by `request.ip` without trusting proxy headers. Behind the reverse proxy and nginx, every visitor shares one address, so the default of 10 per minute applies to everyone together. Trusting `X-Forwarded-For` from the proxy would restore per-visitor limits.
- [DECISION REQUIRED: endy-rkt] A public domain redistributes the published media. D18 requires rights clearance before that. Until it is cleared, the site can stay behind basic authentication at the reverse proxy.
- [DECISION REQUIRED: salandri-42] NFT network for production: the public test network of `apps/backend/nft/.env.example` (contract, funded minter key, Pinata JWT) or the opt-in local chain.
