import base64
import logging
from typing import Any

import httpx

from app.config import HTTP_CLIENT_VERIFY, settings

logger = logging.getLogger(__name__)

def is_cloud() -> bool:
    """Return True when the configured Confluence instance is Atlassian Cloud (*.atlassian.net)."""
    return ".atlassian.net" in settings.confluence_base_url


def is_configured() -> bool:
    if not settings.confluence_base_url or not settings.confluence_api_token:
        return False
    if settings.confluence_auth_type == "bearer":
        return True
    return bool(settings.confluence_user_email)


_is_configured = is_configured


def _auth_headers() -> dict[str, str]:
    if settings.confluence_auth_type == "bearer":
        return {"Authorization": f"Bearer {settings.confluence_api_token}"}
    creds = base64.b64encode(
        f"{settings.confluence_user_email}:{settings.confluence_api_token}".encode()
    ).decode()
    return {"Authorization": f"Basic {creds}"}


async def _request(
    method: str,
    path: str,
    **kwargs: Any,
) -> dict[str, Any]:
    if not _is_configured():
        raise RuntimeError("Confluence credentials are not configured")
    url = f"{settings.confluence_api_base}{path}"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        **_auth_headers(),
    }
    async with httpx.AsyncClient(verify=HTTP_CLIENT_VERIFY) as client:
        resp = await client.request(
            method,
            url,
            headers=headers,
            **kwargs,
        )
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = ""
            try:
                body = exc.response.text
            except Exception:
                pass
            raise httpx.HTTPStatusError(
                f"{exc.response.status_code} {exc.response.reason_phrase}: {body}",
                request=exc.request,
                response=exc.response,
            ) from None
        if resp.status_code == 204 or not resp.text:
            return {}
        return resp.json()


async def validate_space(space_key: str) -> dict[str, Any]:
    """Check whether a Confluence space exists and is accessible.

    Returns a dict: { valid: bool, name?: str, error?: str }.
    """
    try:
        data = await _request("GET", f"/rest/api/space/{space_key}")
        return {"valid": True, "name": data.get("name", ""), "key": space_key}
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return {"valid": False, "error": f"Space '{space_key}' does not exist", "key": space_key}
        return {"valid": False, "error": str(exc), "key": space_key}
    except Exception as exc:
        return {"valid": False, "error": str(exc), "key": space_key}


async def search_pages(space_key: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
    """Search pages in a Confluence space using CQL.

    Returns a list of { id, title } dicts.
    """
    cql = f'space = "{space_key}" AND type = "page"'
    if query.strip():
        cql += f' AND title ~ "{query.strip().replace(chr(34), chr(92)+chr(34))}"'
    data = await _request(
        "GET",
        "/rest/api/search",
        params={"cql": cql, "limit": str(limit), "start": "0"},
    )
    results: list[dict[str, Any]] = []
    for item in data.get("results", []):
        content = item.get("content", {})
        page_id = content.get("id")
        title = content.get("title")
        if page_id and title:
            results.append({"id": str(page_id), "title": str(title)})
    return results


async def get_page(page_id: str) -> dict[str, Any]:
    """Fetch a page with its current version and storage body."""
    return await _request(
        "GET",
        f"/rest/api/content/{page_id}?expand=version,body.storage",
    )


async def get_page_parent_id(page_id: str) -> str | None:
    """Return the direct parent page ID of a Confluence page, or None if at root."""
    try:
        data = await _request("GET", f"/rest/api/content/{page_id}?expand=ancestors")
        ancestors = data.get("ancestors", [])
        return str(ancestors[-1]["id"]) if ancestors else None
    except Exception:
        return None


async def get_space_homepage_id(space_key: str) -> str | None:
    """Return the homepage page ID for a Confluence space, or None on failure."""
    try:
        data = await _request("GET", f"/rest/api/space/{space_key}?expand=homepage")
        homepage = data.get("homepage", {})
        page_id = homepage.get("id")
        return str(page_id) if page_id else None
    except Exception:
        return None


async def create_page(
    space_key: str,
    title: str,
    xhtml: str,
    parent_page_id: str | None = None,
) -> dict[str, Any]:
    """Create a new Confluence page. Returns the API response dict."""
    payload: dict[str, Any] = {
        "type": "page",
        "title": title,
        "space": {"key": space_key},
        "body": {
            "storage": {
                "value": xhtml,
                "representation": "storage",
            }
        },
    }
    if parent_page_id:
        payload["ancestors"] = [{"id": parent_page_id}]

    data = await _request("POST", "/rest/api/content", json=payload)
    logger.info("Confluence page created: %s", data.get("id"))
    return data


async def update_page(
    page_id: str,
    title: str,
    xhtml: str,
    parent_page_id: str | None = None,
    move_to_root: bool = False,
) -> dict[str, Any]:
    """Update an existing Confluence page. Fetches current version first."""
    current = await get_page(page_id)
    version = current.get("version", {}).get("number", 1)
    payload: dict[str, Any] = {
        "id": page_id,
        "type": "page",
        "title": title,
        "body": {
            "storage": {
                "value": xhtml,
                "representation": "storage",
            }
        },
        "version": {"number": version + 1},
    }
    if parent_page_id:
        payload["ancestors"] = [{"id": parent_page_id}]
    elif move_to_root:
        homepage_id = await get_space_homepage_id(settings.confluence_space_key)
        if homepage_id:
            payload["ancestors"] = [{"id": homepage_id}]
    data = await _request("PUT", f"/rest/api/content/{page_id}", json=payload)
    logger.info("Confluence page updated: %s", page_id)
    return data


async def delete_page(page_id: str) -> None:
    """Delete a Confluence page by ID."""
    await _request("DELETE", f"/rest/api/content/{page_id}")
    logger.info("Confluence page deleted: %s", page_id)


async def upload_attachments(page_id: str, attachments: list[dict[str, Any]]) -> None:
    """Upload binary attachments to a Confluence page.

    Each item: { "filename": str, "content": bytes, "content_type": str }.
    Uses the multipart attachment API — works on both DC and Cloud.
    """
    if not _is_configured():
        return
    url = f"{settings.confluence_api_base}/rest/api/content/{page_id}/child/attachment"
    headers = {
        "Accept": "application/json",
        "X-Atlassian-Token": "no-check",
        **_auth_headers(),
    }
    async with httpx.AsyncClient(verify=HTTP_CLIENT_VERIFY) as client:
        for att in attachments:
            files = {
                "file": (att["filename"], att["content"], att["content_type"]),
                "comment": (None, "Uploaded by Migration Hub"),
            }
            resp = await client.post(url, headers=headers, files=files)
            if resp.status_code not in (200, 201):
                logger.warning(
                    "Attachment upload failed for %s: %s %s",
                    att["filename"],
                    resp.status_code,
                    resp.text[:200],
                )


def _build_page_url(data: dict[str, Any]) -> str:
    """Build a human-readable page URL from the Confluence API response."""
    links = data.get("_links", {})
    base = links.get("base", settings.confluence_base_url.rstrip("/"))
    webui = links.get("webui", "")
    if webui:
        return f"{base}{webui}"
    page_id = data.get("id", "")
    space_key = data.get("space", {}).get("key", settings.confluence_space_key)
    return f"{settings.confluence_base_url}/spaces/{space_key}/pages/{page_id}"


async def export_engagement_notes(
    project_name: str,
    interview_subject: str | None,
    notes: list[dict[str, Any]],
    existing_page_id: str | None,
    parent_page_id: str | None,
    move_to_root: bool = False,
) -> dict[str, str]:
    """High-level helper: create or update a Confluence page for engagement notes.

    Returns { "confluencePageId": "...", "confluencePageUrl": "..." }.
    """
    if not _is_configured():
        raise RuntimeError("Confluence integration is not configured")

    from app.services.blocks_to_confluence import convert as blocks_to_xhtml

    xhtml, attachments = blocks_to_xhtml(notes, is_cloud=is_cloud())
    title = interview_subject or f"Engagement Notes — {project_name}"

    if existing_page_id:
        data = await update_page(existing_page_id, title, xhtml, parent_page_id=parent_page_id, move_to_root=move_to_root)
    else:
        data = await create_page(
            space_key=settings.confluence_space_key,
            title=title,
            xhtml=xhtml,
            parent_page_id=parent_page_id,
        )

    page_id = str(data.get("id", ""))
    if attachments:
        await upload_attachments(page_id, attachments)

    page_url = _build_page_url(data)
    return {
        "confluencePageId": page_id,
        "confluencePageUrl": page_url,
    }
