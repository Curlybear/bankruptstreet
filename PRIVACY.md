# Privacy Notice

Bankrupt Street is a casual multiplayer game with **no user accounts**. This
notice describes everything it collects and how long it keeps it. It's also
available in-game via the **privacy** link in the lobby.

## What you provide

- **A display name** you type when joining a room. It labels your seat and is
  shown to the other players in that room. This is the only personal detail
  requested — there is no email, password, or account.

## Stored in your browser

- Your most recent **display name** and a **per-room session token** are kept in
  this browser's `localStorage` so you can reconnect to your seat. These are not
  tracking cookies and are not sent anywhere except to this game's own server to
  prove you own your seat. Clearing site data removes them.

## On the server

- **Active game state** (including the display names of players in a room) is
  held in memory and written to a local file so games survive a server restart.
- **Rooms are deleted** roughly 30 minutes after they go idle, which removes the
  names stored with them.
- **Connection logs** (IP address, timestamps, socket identifiers) may be kept
  transiently to operate the service and prevent abuse, per standard server
  practice.

## What is *not* done

- No analytics, no advertising, no third-party trackers.
- No selling or sharing of data with anyone.
- Fonts are served from this site (no Google Fonts / external CDN), so loading
  the game makes no third-party requests.

## Source & contact

The complete source is available under the GNU AGPL-3.0 license — see the
[project repository](https://github.com/Curlybear/bankruptstreet). Operators who
self-host should add their own contact details here.
