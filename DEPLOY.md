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
