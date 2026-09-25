from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import load_settings
from .proxy import proxy_media
from .subsonic import SubsonicClient, SubsonicError

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

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


@app.get("/")
async def index():
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host=settings.app_host, port=settings.app_port
    )
