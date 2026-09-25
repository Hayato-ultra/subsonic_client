import json

from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from .subsonic import SubsonicClient

_FORWARD_HEADERS = (
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
)


async def proxy_media(
    subsonic: SubsonicClient,
    request: Request,
    endpoint: str,
    params: dict[str, str],
) -> StreamingResponse:
    headers: dict[str, str] = {}
    range_value = request.headers.get("range")
    if range_value:
        headers["range"] = range_value

    upstream_request = subsonic.build_request(endpoint, params, headers=headers)
    upstream = await subsonic.http.send(upstream_request, stream=True)

    if upstream.status_code >= 400:
        raw = await upstream.aread()
        await upstream.aclose()
        detail = f"{endpoint} failed with status {upstream.status_code}"
        try:
            payload = json.loads(raw)
            err = payload.get("subsonic-response", {}).get("error")
            if err:
                detail = str(err.get("message", detail))
        except (json.JSONDecodeError, AttributeError, TypeError):
            pass
        status = upstream.status_code
        if status < 400 or status > 599:
            status = 502
        raise HTTPException(status_code=status, detail=detail)

    out_headers = {
        h: upstream.headers[h] for h in _FORWARD_HEADERS if h in upstream.headers
    }
    # Add CORS headers for audio element with crossorigin="anonymous"
    out_headers["access-control-allow-origin"] = "*"
    out_headers["access-control-allow-methods"] = "GET, HEAD, OPTIONS"
    out_headers["access-control-allow-headers"] = "Range"
    out_headers["access-control-expose-headers"] = "Content-Length, Content-Range, Accept-Ranges"
    return StreamingResponse(
        upstream.aiter_raw(),
        status_code=upstream.status_code,
        headers=out_headers,
        background=BackgroundTask(upstream.aclose),
    )
