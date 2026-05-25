import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_ZOOM_API_BASE = "https://api.zoom.us/v2"
_TOKEN_URL = "https://zoom.us/oauth/token"


class ZoomClient:
    def __init__(self) -> None:
        self._access_token: str | None = None
        self._token_expires_at: datetime | None = None

    @property
    def _is_configured(self) -> bool:
        return bool(
            settings.zoom_account_id
            and settings.zoom_client_id
            and settings.zoom_client_secret
        )

    async def _ensure_token(self) -> str:
        if self._access_token and self._token_expires_at and datetime.now(timezone.utc) < self._token_expires_at:
            return self._access_token

        if not self._is_configured:
            raise RuntimeError("Zoom credentials are not configured")

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                _TOKEN_URL,
                auth=(settings.zoom_client_id, settings.zoom_client_secret),
                data={
                    "grant_type": "account_credentials",
                    "account_id": settings.zoom_account_id,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            self._access_token = data["access_token"]
            expires_in = data.get("expires_in", 3600)
            self._token_expires_at = datetime.now(timezone.utc).replace(microsecond=0)
            self._token_expires_at = self._token_expires_at.replace(second=0)
            self._token_expires_at = datetime.fromtimestamp(
                self._token_expires_at.timestamp() + expires_in - 60,
                tz=timezone.utc,
            )
            return self._access_token

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        token = await self._ensure_token()
        async with httpx.AsyncClient() as client:
            resp = await client.request(
                method,
                f"{_ZOOM_API_BASE}{path}",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                **kwargs,
            )
            resp.raise_for_status()
            if resp.status_code == 204:
                return {}
            return resp.json()

    async def create_meeting(
        self,
        topic: str,
        start_time: str,
        duration: int,
        participant_emails: list[str],
    ) -> dict[str, Any]:
        """Create a scheduled Zoom meeting."""
        if not self._is_configured:
            raise RuntimeError("Zoom credentials are not configured")

        payload = {
            "topic": topic,
            "type": 2,  # Scheduled meeting
            "start_time": start_time,
            "duration": duration,
            "timezone": "UTC",
            "settings": {
                "join_before_host": True,
                "mute_upon_entry": True,
                "waiting_room": False,
                "participant_video": False,
                "host_video": True,
                "auto_recording": "cloud",
                "meeting_invitees": [{"email": e} for e in participant_emails],
            },
        }

        # Use the admin user's "me" endpoint to create the meeting
        result = await self._request("POST", "/users/me/meetings", json=payload)
        logger.info("Zoom meeting created: %s", result.get("id"))
        return result

    async def update_meeting(
        self,
        meeting_id: str,
        topic: str | None = None,
        start_time: str | None = None,
        duration: int | None = None,
    ) -> dict[str, Any]:
        if not self._is_configured:
            raise RuntimeError("Zoom credentials are not configured")

        payload: dict[str, Any] = {}
        if topic is not None:
            payload["topic"] = topic
        if start_time is not None:
            payload["start_time"] = start_time
        if duration is not None:
            payload["duration"] = duration

        result = await self._request("PATCH", f"/meetings/{meeting_id}", json=payload)
        logger.info("Zoom meeting updated: %s", meeting_id)
        return result

    async def delete_meeting(self, meeting_id: str) -> None:
        if not self._is_configured:
            raise RuntimeError("Zoom credentials are not configured")

        await self._request("DELETE", f"/meetings/{meeting_id}")
        logger.info("Zoom meeting deleted: %s", meeting_id)


zoom_client = ZoomClient()


async def schedule_meeting(
    topic: str,
    start_time: str,
    duration_minutes: int,
    participant_emails: list[str],
) -> dict[str, Any]:
    return await zoom_client.create_meeting(topic, start_time, duration_minutes, participant_emails)


async def update_meeting(
    meeting_id: str,
    topic: str | None = None,
    start_time: str | None = None,
    duration: int | None = None,
) -> dict[str, Any]:
    return await zoom_client.update_meeting(meeting_id, topic, start_time, duration)


async def cancel_meeting(meeting_id: str) -> None:
    return await zoom_client.delete_meeting(meeting_id)
