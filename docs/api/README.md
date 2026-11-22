# API contracts

Producers own their OpenAPI documents here (D14). The [platform contract](../specs/platform-contract.md) explains the shared vocabulary, the gateway routes, caller context and public errors.

| Document                                     | Owner             | Consumers           |
| -------------------------------------------- | ----------------- | ------------------- |
| [gateway.openapi.yaml](gateway.openapi.yaml) | Agent 1 (gateway) | Frontend            |
| [auth.openapi.yaml](auth.openapi.yaml)       | Agent 1 (Auth)    | Gateway             |
| `content.openapi.yaml`                       | Agent 2 (Content) | Gateway, NFT, LiDAR |
| `nft.openapi.yaml`                           | Agent 2 (NFT)     | Gateway             |
| `lidar.yaml`                                 | Agent 3 (LiDAR)   | Gateway             |

Change a frozen route or payload only through a `[CONTRACT CHANGE]` pull request agreed by the three agents.
