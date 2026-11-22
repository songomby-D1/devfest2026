# Demo environment

## Hosted demo

The demo runs on the staging VPS at <https://lova.forastech.duckdns.org>. Check it before a rehearsal:

```sh
curl -sS https://lova.forastech.duckdns.org/api/health
# {"status":"ok","upstreams":{"auth":"up","content":"up","nft":"up","lidar":"up"}}
```

Verified on 2026-11-22: the five reviewed works are published (`/api/items`), guests get 401 from
`/api/auth/me`, and TLS comes from a Let's Encrypt certificate behind Caddy in front of nginx. How the
VPS is deployed is not recorded in this repository yet; the local runbook below is the offline fallback.

## Local demo

Runs the whole LOVA stack locally with real public-domain Malagasy works and a local EVM chain, so the
NFT and blockchain journey can be tested end to end. Local only: never reuse these settings elsewhere.

```sh
node scripts/demo/setup.mjs            # .env + apps/backend/nft/.env (random secrets, random gallery key)
node scripts/demo/fetch-media.mjs      # public-domain / CC0 images into scripts/demo/media (gitignored)
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d chain
node scripts/demo/deploy-contract.mjs  # PreservingArt (feature/nft-l1) on chain 31337, owned by the gallery wallet
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
node scripts/demo/seed.mjs             # submit, review (item and description separately) and publish 5 works
node scripts/demo/nft-walkthrough.mjs  # NFT + blockchain acceptance checks; add --all to mint every work
```

- `docker-compose.demo.yml` adds the local chain (Ganache 7.9.2, chain id 31337, run from the multi-arch
  `node:20-bookworm-slim` image because the published Ganache image is amd64-only and dies with `exec format
error` on arm64 laptops) and runs the NFT service from its runtime image; the Content storage and NFT
  database settings come from the root Compose file.
- IPFS uses the NFT service's `fake` driver: CIDs are computed but nothing is served online.
- Works, sources and licenses: [items.json](items.json). Images stay out of Git until cleared under D18.
- `fetch-media.mjs` identifies itself to Wikimedia and retries 429/5xx with backoff; without a contact
  User-Agent Wikimedia throttles the download.
- After `deploy-contract.mjs` on a running stack, restart `nft-service` so it reads `CONTRACT_ADDRESS`.
