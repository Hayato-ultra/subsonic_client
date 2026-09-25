import hashlib
import secrets
from typing import Any

import httpx

from .config import Settings

CLIENT_NAME = "subsonic_client"
API_VERSION = "1.16.1"


class SubsonicError(Exception):
    def __init__(self, code: int, message: str) -> None:
        super().__init__(f"Subsonic error {code}: {message}")
        self.code = code
        self.message = message


class SubsonicClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self.http = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, read=600.0),
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        await self.http.aclose()

    def _auth_params(self) -> dict[str, str]:
        salt = secrets.token_hex(8)
        token = hashlib.md5(
            (self._settings.gonic_password + salt).encode("utf-8")
        ).hexdigest()
        return {
            "u": self._settings.gonic_user,
            "s": salt,
            "t": token,
            "c": CLIENT_NAME,
            "v": API_VERSION,
            "f": "json",
        }

    def build_request(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
        *,
        headers: dict[str, str] | None = None,
    ) -> httpx.Request:
        query = self._auth_params()
        if params:
            query.update({k: str(v) for k, v in params.items() if v is not None})
        return self.http.build_request(
            "GET",
            f"{self._settings.gonic_url}/rest/{endpoint}",
            params=query,
            headers=headers,
        )

    async def get(
        self, endpoint: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        request = self.build_request(endpoint, params)
        response = await self.http.send(request)
        try:
            response.raise_for_status()
            data = response.json()
        finally:
            await response.aclose()
        return self._unwrap(data)

    @staticmethod
    def _unwrap(data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            raise SubsonicError(0, "Invalid response from server")
        payload = data.get("subsonic-response", data)
        if not isinstance(payload, dict):
            raise SubsonicError(0, "Invalid response from server")
        error = payload.get("error")
        if error:
            raise SubsonicError(
                int(error.get("code", 0) or 0),
                str(error.get("message", "unknown error")),
            )
        status = payload.get("status")
        if status not in (None, "ok"):
            raise SubsonicError(0, f"Unexpected status: {status}")
        return payload
