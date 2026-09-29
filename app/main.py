from contextlib import asynccontextmanager
from pathlib import Path as PathLib
from typing import Annotated, Any
import asyncio
import os
import shlex

import httpx
from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import load_settings
from .proxy import proxy_media
from .subsonic import SubsonicClient, SubsonicError

FRONTEND_DIR = PathLib(__file__).resolve().parent.parent / "frontend"
settings = load_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = SubsonicClient(settings)
    app.state.subsonic = client
    try:
        yield
    finally:
        await client.aclose()


app = FastAPI(title="Subsonic Client", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _subsonic(request: Request) -> SubsonicClient:
    return request.app.state.subsonic


async def _get(
    request: Request, endpoint: str, **params: Any
) -> dict[str, Any]:
    try:
        return await _subsonic(request).get(endpoint, params or None)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Cannot reach gonic: {exc}"
        ) from exc


@app.exception_handler(SubsonicError)
async def subsonic_error_handler(request: Request, exc: SubsonicError):
    return JSONResponse(status_code=502, content={"detail": exc.message})


# ---------- Media & Metadata ----------
@app.get("/api/ping")
async def ping(request: Request):
    return await _get(request, "ping")


@app.get("/api/artists")
async def artists(request: Request):
    return await _get(request, "getArtists")


@app.get("/api/indexes")
async def indexes(request: Request):
    return await _get(request, "getIndexes")


@app.get("/api/albums")
async def albums(
    request: Request,
    list_type: str = Query("newest", alias="type"),
    size: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return await _get(
        request, "getAlbumList2", type=list_type, size=size, offset=offset
    )


@app.get("/api/album")
async def album(request: Request, id: str = Query(..., min_length=1)):
    return await _get(request, "getAlbum", id=id)


@app.get("/api/artist")
async def artist(request: Request, id: str = Query(..., min_length=1)):
    return await _get(request, "getArtist", id=id)


@app.get("/api/search")
async def search(request: Request, q: str = Query(..., min_length=1)):
    return await _get(request, "search3", query=q, count=30)


@app.get("/api/genres")
async def genres(request: Request):
    return await _get(request, "getGenres")


@app.get("/api/genre-songs")
async def genre_songs(
    request: Request,
    genre: str = Query(..., min_length=1),
    size: int = Query(100, ge=1, le=500),
):
    return await _get(request, "getSongsByGenre", genre=genre, size=size)


@app.get("/api/random")
async def random_songs(
    request: Request, size: int = Query(50, ge=1, le=500)
):
    return await _get(request, "getRandomSongs", size=size)


@app.get("/api/stream")
async def stream(request: Request, id: str = Query(..., min_length=1)):
    return await proxy_media(
        _subsonic(request),
        request,
        "stream",
        {"id": id, "maxBitRate": str(settings.stream_bitrate)},
    )


@app.get("/api/cover")
async def cover(request: Request, id: str = Query(..., min_length=1)):
    return await proxy_media(
        _subsonic(request), request, "getCoverArt", {"id": id}
    )


# ---------- Playlist API (proxied to gonic Subsonic) ----------
@app.get("/api/playlists")
async def get_playlists(request: Request):
    return await _get(request, "getPlaylists")


@app.get("/api/playlist")
async def get_playlist(request: Request, id: str = Query(..., min_length=1)):
    return await _get(request, "getPlaylist", id=id)


@app.post("/api/playlist/create")
async def create_playlist(request: Request, name: str = Query(..., min_length=1)):
    return await _get(request, "createPlaylist", name=name)


@app.post("/api/playlist/save")
async def save_playlist(
    request: Request,
    playlistId: str = Query(..., min_length=1),
    name: str = Query(..., min_length=1),
    songIdToAdd: str = Query(None),
    songIdToRemove: str = Query(None),
):
    return await _get(
        request, "savePlaylist", id=playlistId, name=name,
        **({"songIdToAdd": songIdToAdd} if songIdToAdd else {}),
        **({"songIdToRemove": songIdToRemove} if songIdToRemove else {})
    )


@app.post("/api/playlist/update")
async def update_playlist(
    request: Request,
    playlistId: str = Query(..., min_length=1),
    songIdToAdd: str = Query(None),
    songIdToRemove: str = Query(None),
):
    return await _get(
        request, "updatePlaylist", id=playlistId,
        **({"songIdToAdd": songIdToAdd} if songIdToAdd else {}),
        **({"songIdToRemove": songIdToRemove} if songIdToRemove else {})
    )


@app.delete("/api/playlist/{id}")
async def delete_playlist(request: Request, id: Annotated[str, Path(min_length=1)]):
    return await _get(request, "deletePlaylist", id=id)


@app.put("/api/playlist/{id}")
async def rename_playlist(request: Request, id: Annotated[str, Path(min_length=1)], name: str = Query(..., min_length=1)):
    return await _get(request, "savePlaylist", id=id, name=name)


@app.post("/api/import/link")
async def import_link(
    request: Request,
    url: str = Query(..., min_length=1),
    playlist: str = Query(None),
    mode: str = Query("local"),
):
    """
    Import a song/playlist from a URL (YouTube, Spotify, SoundCloud, etc.)
    
    Modes:
    - local: Run gonic-dl locally (FastAPI and Termux on same device)
    - ssh: Run gonic-dl via SSH on remote Termux device
    """
    gonic_host = settings.gonic_url.rstrip("/")
    gonic_user = settings.gonic_user
    gonic_pass = settings.gonic_password

    if mode == "ssh":
        ssh_host = os.environ.get("TERMUX_SSH_HOST", "termux@localhost")
        ssh_port = os.environ.get("TERMUX_SSH_PORT", "8022")
        ssh_password = os.environ.get("TERMUX_SSH_PASSWORD", "")
        music_path = os.environ.get("GONIC_MUSIC_PATH", "~/storage/shared/Music")
        remote_script = f"""export GONIC_HOST={shlex.quote(gonic_host)}
export GONIC_USER={shlex.quote(gonic_user)}
export GONIC_PASS={shlex.quote(gonic_pass)}
export GONIC_MUSIC_PATH={shlex.quote(music_path)}
gonic-dl {shlex.quote(url)} {shlex.quote(playlist or '')}
"""
        if ssh_password:
            cmd = ["sshpass", "-p", ssh_password, "ssh", "-o", "StrictHostKeyChecking=no", "-p", ssh_port, ssh_host, "bash", "-s"]
        else:
            cmd = ["ssh", "-p", ssh_port, ssh_host, "bash", "-s"]
    else:
        env = {
            **os.environ,
            "GONIC_HOST": gonic_host,
            "GONIC_USER": gonic_user,
            "GONIC_PASS": gonic_pass,
            "GONIC_MUSIC_PATH": os.environ.get("GONIC_MUSIC_PATH", "~/storage/shared/Music"),
        }
        cmd = ["gonic-dl", url]
        if playlist:
            cmd.append(playlist)

    try:
        if mode == "ssh":
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=remote_script.encode()), timeout=600
            )
        else:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)
        
        return {
            "status": "ok" if proc.returncode == 0 else "error",
            "mode": mode,
            "url": url,
            "playlist": playlist,
            "output": stdout.decode()[-3000:],
            "error": stderr.decode()[-3000:] if proc.returncode != 0 else None,
            "returncode": proc.returncode,
        }
    except asyncio.TimeoutError:
        return {"status": "error", "error": "Download timed out (10 min)", "returncode": -1}
    except FileNotFoundError:
        return {"status": "error", "error": "gonic-dl not found. Install it in Termux: `~/bin/gonic-dl`", "returncode": -1}
    except Exception as e:
        return {"status": "error", "error": str(e), "returncode": -1}


@app.post("/api/admin/scan")
async def trigger_scan(request: Request):
    """Manually trigger a gonic library scan"""
    return await _get(request, "startScan")


@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "service": "subsonic-client"}


@app.get("/")
async def index():
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.app_host, port=settings.app_port)
