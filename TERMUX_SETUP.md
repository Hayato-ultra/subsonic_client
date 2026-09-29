# Termux Setup: Add Songs to Gonic via Links (YouTube, Spotify, etc.)

## Prerequisites

- **Termux** from **F-Droid** or **GitHub Releases** (NOT Play Store)
- **Termux:API** from F-Droid (for notifications, optional)
- **Termux:Widget** from F-Droid (for home screen shortcuts, optional)
- Android 7.0+

---

## 1. Fresh Termux Install

```bash
# Open Termux and run:
pkg update && pkg upgrade -y

# Grant storage access (creates ~/storage)
termux-setup-storage

# Install core packages
pkg install -y python ffmpeg git curl wget jq

# Verify
python --version    # 3.11+
ffmpeg -version     # Should show version
```

---

## 2. Install yt-dlp (YouTube, SoundCloud, Bandcamp, etc.)

```bash
# Option A: pip (if pydantic works)
pip install -U "yt-dlp[default]"

# Option B: Binary (no Python deps issues) — RECOMMENDED
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/bin/yt-dlp
chmod +x ~/bin/yt-dlp
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc

# Test
yt-dlp --version
```

---

## 3. Install spotdl (Spotify) — Optimized for Termux

**Don't use `pip install spotdl` directly** — it compiles Rust and fails on mobile.

```bash
# Use the optimized installer (pre-built wheels, no Rust compilation)
curl -sL https://raw.githubusercontent.com/Eutalix/termux-spotdl-installer/main/install_spotdl.sh | bash

# This installs:
# - Python + FFmpeg (if missing)
# - spotdl with Android-compatible wheels
# - Auto-configures download to ~/storage/shared/Music
# - Creates Termux:Widget shortcut (if installed)

# Test
spotdl --version
```

**If you need Spotify credentials** (for private playlists/liked songs):
```bash
# Get from https://developer.spotify.com/dashboard
mkdir -p ~/.config/spotdl
cat > ~/.config/spotdl/config.json << 'EOF'
{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "output": "~/storage/shared/Music/{artist}/{album}/{title}.opus",
  "format": "opus",
  "bitrate": "320k",
  "ffmpeg": "ffmpeg"
}
EOF
```

---

## 4. Configure Gonic Music Path

Ensure gonic and Termux share the **same music directory**.

**Option A: Use Termux's shared storage (easiest)**
```bash
# In Termux
export GONIC_MUSIC_PATH=~/storage/shared/Music
mkdir -p "$GONIC_MUSIC_PATH"
```

**Option B: Dedicated folder (if gonic runs in container/proot)**
```bash
# In Termux
export GONIC_MUSIC_PATH=/data/music
mkdir -p "$GONIC_MUSIC_PATH"
```

**Add to `~/.bashrc`:**
```bash
echo 'export GONIC_MUSIC_PATH=~/storage/shared/Music' >> ~/.bashrc
source ~/.bashrc
```

---

## 5. Create Download Script (`~/bin/gonic-dl`)

```bash
mkdir -p ~/bin
cat > ~/bin/gonic-dl << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# gonic-dl: Download audio from URL and trigger gonic scan
# Usage: gonic-dl "https://youtube.com/watch?v=..." [playlist_name]

set -euo pipefail

URL="${1:-}"
PLAYLIST_NAME="${2:-}"

if [[ -z "$URL" ]]; then
  echo "Usage: gonic-dl <URL> [playlist_name]"
  exit 1
fi

MUSIC_ROOT="${GONIC_MUSIC_PATH:-~/storage/shared/Music}"
MUSIC_ROOT="${MUSIC_ROOT/#\~/$HOME}"

# Detect source
if [[ "$URL" =~ (youtube\.com|youtu\.be|soundcloud\.com|bandcamp\.com) ]]; then
  DOWNLOADER="yt-dlp"
elif [[ "$URL" =~ (open\.spotify\.com|spotify\.com) ]]; then
  DOWNLOADER="spotdl"
else
  echo "Unsupported URL: $URL"
  exit 1
fi

# Notify start
termux-notification --title "gonic-dl" --content "Downloading: $URL" --id gonic-dl 2>/dev/null || true

# Download
if [[ "$DOWNLOADER" == "yt-dlp" ]]; then
  yt-dlp \
    -f "bestaudio[ext=opus]/bestaudio" \
    --extract-audio \
    --audio-format opus \
    --audio-quality 0 \
    --embed-thumbnail \
    --embed-metadata \
    --add-metadata \
    -o "$MUSIC_ROOT/%(artist,Unknown Artist)s/%(album,Unknown Album)s/%(title)s.%(ext)s" \
    "$URL"
elif [[ "$DOWNLOADER" == "spotdl" ]]; then
  spotdl download "$URL" --output "$MUSIC_ROOT/{artist}/{album}/{title}.opus" --format opus --bitrate 320k
fi

# Trigger gonic scan via API (adjust host/port/user)
GONIC_HOST="${GONIC_HOST:-http://localhost:4553}"
GONIC_USER="${GONIC_USER:-admin}"
GONIC_PASS="${GONIC_PASS:-}"

if [[ -n "$GONIC_PASS" ]]; then
  curl -s -X POST "$GONIC_HOST/rest/startScan" \
    -u "$GONIC_USER:$GONIC_PASS" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "u=$GONIC_USER&t=$(date +%s)$(openssl rand -hex 8)&s=$(echo -n "$GONIC_PASS$(openssl rand -hex 8)" | md5sum | cut -d' ' -f1)&v=1.16.1&c=termux-gonic" \
    >/dev/null && echo "Scan triggered" || echo "Scan trigger failed (check credentials)"
fi

termux-notification --title "gonic-dl" --content "Done! Scan triggered." --id gonic-dl 2>/dev/null || true
echo "✅ Download complete. Gonic scan triggered."
EOF

chmod +x ~/bin/gonic-dl
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

---

## 6. Test the Script

```bash
# Test YouTube
gonic-dl "https://youtu.be/dQw4w9WgXcQ"

# Test Spotify (needs credentials in ~/.config/spotdl/config.json)
gonic-dl "https://open.spotify.com/track/..."
```

---

## 7. Integrate with Your FastAPI Backend

### Option A: Call script from FastAPI (if FastAPI runs on same device)

**Add to `app/main.py`:**
```python
import subprocess
import asyncio

@app.post("/api/import/link")
async def import_link(request: Request, url: str = Query(...), playlist: str = Query(None)):
    proc = await asyncio.create_subprocess_exec(
        "gonic-dl", url, playlist or "",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return {
        "status": "ok" if proc.returncode == 0 else "error",
        "output": stdout.decode(),
        "error": stderr.decode() if proc.returncode != 0 else None,
    }
```

### Option B: Webhook from Termux to FastAPI (if separate devices)

**In `gonic-dl` script, add after download:**
```bash
# Notify FastAPI to trigger scan
FASTAPI_HOST="${FASTAPI_HOST:-http://192.168.1.xxx:8000}"
curl -s -X POST "$FASTAPI_HOST/api/admin/scan" -H "Content-Type: application/json" -d '{}' >/dev/null
```

**Add endpoint in FastAPI:**
```python
@app.post("/api/admin/scan")
async def trigger_scan(request: Request):
    await _get(request, "startScan")
    return {"status": "scan_started"}
```

---

## 8. Quick Share Integration (Android Share Menu)

**Create `~/.shortcuts/gonic-dl` (for Termux:Widget):**
```bash
mkdir -p ~/.shortcuts
cat > ~/.shortcuts/gonic-dl << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Termux:Widget shortcut - receives URL from Android share menu

URL="${1:-$TERMUX_URL}"
if [[ -z "$URL" ]]; then
  termux-toast "No URL received"
  exit 1
fi

~/bin/gonic-dl "$URL"
EOF
chmod +x ~/.shortcuts/gonic-dl
```

**Usage:**
1. Add **Termux:Widget** to home screen
2. Select `gonic-dl` shortcut
3. In YouTube/Spotify app → Share → "Termux:Widget gonic-dl"

---

## 9. Gonic Auto-Scan Config

In gonic config/env:
```bash
# Enable file watcher (instant detection)
GONIC_SCAN_WATCHER_ENABLED=true

# Fallback periodic scan (minutes)
GONIC_SCAN_INTERVAL=5

# Scan on startup
GONIC_SCAN_AT_START_ENABLED=true
```

Or via command line:
```bash
gonic \
  -music-path "/data/music" \
  -scan-watcher-enabled \
  -scan-interval 5 \
  -scan-at-start-enabled
```

---

## 10. Troubleshooting

| Issue | Fix |
|-------|-----|
| `pip install` fails on pydantic/Rust | Use binary `yt-dlp` + `spotdl` installer script |
| "Permission denied" writing to storage | Run `termux-setup-storage` again, allow permission |
| Files not visible to gonic | Ensure both use **same path** (`GONIC_MUSIC_PATH`) |
| Spotify "403 Forbidden" | Add `client_id`/`client_secret` to `~/.config/spotdl/config.json` |
| Scan not triggering | Check gonic auth: `curl -u user:pass "http://host:4553/rest/startScan.view"` |
| Battery kills background | Termux → App Info → Battery → **Unrestricted** |

---

## 11. One-Line Install (Copy-Paste)

```bash
pkg update && pkg upgrade -y && pkg install -y python ffmpeg git curl wget jq && termux-setup-storage && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/bin/yt-dlp && chmod +x ~/bin/yt-dlp && echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc && curl -sL https://raw.githubusercontent.com/Eutalix/termux-spotdl-installer/main/install_spotdl.sh | bash && mkdir -p ~/bin && curl -sL https://raw.githubusercontent.com/YOUR_REPO/gonic-dl/main/gonic-dl -o ~/bin/gonic-dl && chmod +x ~/bin/gonic-dl
```

*(Replace the last URL with your actual gonic-dl script location)*

---

## Files Created

```
~/bin/yt-dlp           # yt-dlp binary
~/bin/spotdl           # spotdl (via installer)
~/bin/gonic-dl         # Main download script
~/.config/spotdl/config.json  # Spotify credentials
~/.shortcuts/gonic-dl  # Termux:Widget shortcut
```

---

## Next Steps

1. **Add FastAPI endpoint** `/api/import/link` (see Option A above)
2. **Add "Import from Link" button** in your frontend
3. **Test end-to-end**: Paste YouTube URL → song appears in gonic → play in app