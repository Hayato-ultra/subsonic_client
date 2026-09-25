# Subsonic Client

A lightweight web-based music player for [gonic](https://github.com/sentriz/gonic) (and any Subsonic-compatible server). Runs on desktop or in Termux on Android — browse your library, search, and stream songs through a small local FastAPI server that proxies the Subsonic API.

## Features

- Browse newest albums, artists (by letter), and genres
- Search artists, albums, and songs
- Stream audio with seeking/byte-range support (proxied, credentials stay server-side)
- Fixed bottom player with queue, shuffle-play (random songs), next/prev, and seek bar
- No build step — vanilla HTML/CSS/JS frontend
- Cover art proxied so gonic credentials never reach the browser

## Requirements

- Python 3.10+
- A running gonic (or Subsonic-compatible) server

## Setup

```sh
pip install -r requirements.txt
```

## Configuration

Required environment variables:

| Variable | Description |
|---|---|
| `GONIC_URL` | Base URL of your gonic server, e.g. `http://192.168.1.10:4553` |
| `GONIC_USER` | Subsonic username |
| `GONIC_PASSWORD` | Subsonic password |

Optional:

| Variable | Default | Description |
|---|---|---|
| `STREAM_BITRATE` | `320` | Max bitrate passed to the server (`maxBitRate`) |
| `APP_PORT` | `8000` | Port used by `python -m app.main` |
| `APP_HOST` | `0.0.0.0` | Host used by `python -m app.main` |

The server exits with an error at startup if a required variable is missing.

## Run

### Linux / macOS / Windows

```sh
# Linux/macOS
export GONIC_URL=http://192.168.1.10:4553
export GONIC_USER=myuser
export GONIC_PASSWORD=mypassword
python -m app.main
```

```powershell
# Windows PowerShell
$env:GONIC_URL = "http://192.168.1.10:4553"
$env:GONIC_USER = "myuser"
$env:GONIC_PASSWORD = "mypassword"
python -m app.main
```

Then open <http://localhost:8000>.

Alternatively with uvicorn directly:

```sh
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Termux (Android)

```sh
pkg install python
pip install -r requirements.txt
export GONIC_URL=http://192.168.1.10:4553
export GONIC_USER=myuser
export GONIC_PASSWORD=mypassword
python -m app.main
```

Optional: run `termux-wake-lock` first so audio keeps playing when the screen is off. Open <http://localhost:8000> in your browser (or use the IP of the phone from other devices on your LAN).

## API overview

All endpoints return the inner `subsonic-response` payload as JSON; errors are mapped to HTTP 502 with a `detail` message.

| Route | Subsonic endpoint |
|---|---|
| `GET /api/ping` | `ping` |
| `GET /api/artists` | `getArtists` |
| `GET /api/indexes` | `getIndexes` |
| `GET /api/albums` | `getAlbumList2` |
| `GET /api/album?id=` | `getAlbum` |
| `GET /api/artist?id=` | `getArtist` |
| `GET /api/search?q=` | `search3` |
| `GET /api/genres` | `getGenres` |
| `GET /api/genre-songs?genre=` | `getSongsByGenre` |
| `GET /api/random` | `getRandomSongs` |
| `GET /api/stream?id=` | `stream` (Range-forwarding proxy) |
| `GET /api/cover?id=` | `getCoverArt` (image proxy) |
