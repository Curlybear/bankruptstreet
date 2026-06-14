# Deploying Bankrupt Street

One container serves everything: the Socket.io game server and the built
client, same-origin. Rooms persist in `./data` (bind-mounted), so container
rebuilds don't lose games.

## On the VPS

```bash
git clone git@github.com:Curlybear/bankruptstreet.git
cd bankruptstreet
docker compose up -d --build
```

The app listens on `127.0.0.1:3001` (loopback only — the reverse proxy is the
front door).

## Caddy

Caddy v2 handles TLS and WebSocket upgrades automatically — the whole site is:

```caddyfile
street.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

Reload Caddy (`systemctl reload caddy` or `caddy reload`) and play at
`https://street.example.com`.

## Updating

```bash
git pull
docker compose up -d --build
```

Active rooms survive: state is saved to `data/rooms.json` after every action
and restored on boot. Clients reconnect automatically.

## Knobs

| Env | Default | Meaning |
|---|---|---|
| `PORT` | `3001` | Listen port inside the container |
| `CLIENT_DIST` | `client/dist` | Path to the built client (rarely needed) |
| `CORS_ORIGIN` | `localhost:5173,4173` | Comma-separated allowed socket origins. Prod is same-origin so this usually needs no change; set it only if you serve the client from a different origin than the server. |
| `MAX_ROOMS` | `100` | Cap on concurrent rooms (memory-exhaustion guard). |
| `IDLE_TURN_MS` | `300000` (5 min) | How long a connected player may sit on their turn before a bot takes over their seat. |
| `DISCONNECT_GRACE_MS` | `120000` (2 min) | Reconnect window for a dropped player before a bot takes over their seat. |

### Security model (for self-hosters)

- The app binds to `127.0.0.1` — only the reverse proxy reaches it; terminate TLS at Caddy.
- Players are identified by a **per-seat session token** minted on first join and required to reclaim a name, so seats can't be hijacked by guessing a username. Tokens are persisted with the rooms (in `data/rooms.json`, separate from broadcast state) and flushed on shutdown, so seats stay locked to their owner across restarts.
- On `SIGTERM`/`SIGINT` (e.g. `docker compose` restarts) the server flushes state and seat tokens before exiting, so in-flight games survive a redeploy.
- Per-socket flood limiting and the room cap above mitigate basic DoS. There is **no account system** — anyone with a room link can join an open seat, which is by design for casual play.
