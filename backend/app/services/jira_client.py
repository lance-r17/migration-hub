import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx

from app.config import HTTP_CLIENT_VERIFY, settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def _jira_client() -> AsyncIterator[httpx.AsyncClient]:
    """Yield a reusable httpx client with auth, default headers, and SSL verify."""
    async with httpx.AsyncClient(
        auth=httpx.BasicAuth(settings.jira_user_email, settings.jira_api_token),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        verify=HTTP_CLIENT_VERIFY,
    ) as client:
        yield client


def _api_base() -> str:
    """Return the Jira REST API base URL for the configured API version."""
    return f"{settings.jira_base_url}/rest/api/{settings.jira_api_version}"


def _raise_with_body(exc: httpx.HTTPStatusError) -> None:
    """Re-raise an HTTPStatusError with the response body appended to the message."""
    try:
        body = exc.response.text
    except Exception:
        body = "<unreadable>"
    raise httpx.HTTPStatusError(
        f"{exc}" + (f" | body: {body}" if body else ""),
        request=exc.request,
        response=exc.response,
    ) from exc


async def _get_target_date_field_ids(client: httpx.AsyncClient) -> dict[str, str | None]:
    """Return {'start': <field_id>, 'end': <field_id>} for Jira target date custom fields."""
    try:
        resp = await client.get(f"{_api_base()}/field")
        resp.raise_for_status()
        all_fields = resp.json()
        return {
            "start": next((f["id"] for f in all_fields if f["name"].lower() == "target start"), None),
            "end": next((f["id"] for f in all_fields if f["name"].lower() == "target end"), None),
        }
    except Exception as e:
        logger.warning("Failed to fetch Jira target date field IDs: %s", e)
        return {"start": None, "end": None}


async def _get_epic_name_field_id(client: httpx.AsyncClient) -> str | None:
    """Return the custom field ID for 'Epic Name' if it exists."""
    try:
        resp = await client.get(f"{_api_base()}/field")
        resp.raise_for_status()
        all_fields = resp.json()
        return next((f["id"] for f in all_fields if f["name"].lower() == "epic name"), None)
    except Exception as e:
        logger.warning("Failed to fetch Jira Epic Name field ID: %s", e)
        return None


def _adf_to_text(node: dict | list | str | None) -> str:
    """Recursively extract plain text from an ADF document."""
    if isinstance(node, str):
        return node
    if not node:
        return ""
    if isinstance(node, list):
        return " ".join(_adf_to_text(child) for child in node).strip()
    texts = []
    if "text" in node:
        texts.append(node["text"])
    for child in node.get("content", []):
        child_text = _adf_to_text(child)
        if child_text:
            texts.append(child_text)
    return " ".join(texts).strip()


def _format_description(description: str | dict | None) -> str | dict | None:
    """Format a description for the configured Jira API version."""
    if description is None:
        return None
    if settings.jira_api_version == "2":
        if isinstance(description, str):
            return description
        return _adf_to_text(description)
    # v3 (or default): expect ADF
    if isinstance(description, dict):
        return description
    return {
        "version": 1,
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": description}],
            }
        ],
    }


def _format_comment_body(comment: str) -> str | dict:
    """Format a comment body for the configured Jira API version."""
    if settings.jira_api_version == "2":
        return comment
    return {
        "version": 1,
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": comment}],
            }
        ],
    }


async def update_issue_dates(
    issue_key: str,
    start_date: str | None,
    end_date: str | None,
) -> None:
    """
    Set Target Start Date / Target End Date custom fields on a Jira issue.
    Best-effort — logs warnings on failure, does not raise.
    """
    if not settings.jira_base_url:
        return
    if not start_date and not end_date:
        return

    async with _jira_client() as client:
        ids = await _get_target_date_field_ids(client)
        fields: dict = {}
        if start_date and ids.get("start"):
            fields[ids["start"]] = start_date
        if end_date and ids.get("end"):
            fields[ids["end"]] = end_date
        if not fields:
            return
        url = f"{_api_base()}/issue/{issue_key}"
        logger.info("jira_client update_issue_dates: PUT %s", url)
        try:
            response = await client.put(url, json={"fields": fields})
            response.raise_for_status()
        except Exception as e:
            logger.warning("Failed to update Jira issue dates for %s: %s", issue_key, e)


async def create_epic(
    project_key: str,
    summary: str,
    description: str | None,
    start_date: str | None = None,
    cutover_date: str | None = None,
) -> str:
    """
    Create a Jira Epic via the Jira REST API.
    Returns the epic key (e.g. "MIG-42").
    Raises ValueError if Jira is not configured.
    Raises httpx.HTTPStatusError on Jira API failure.
    """
    if not settings.jira_base_url:
        raise ValueError("Jira not configured")

    fields: dict = {
        "project": {"key": project_key},
        "issuetype": {"name": "Epic"},
        "summary": summary,
    }

    formatted_desc = _format_description(description)
    if formatted_desc:
        fields["description"] = formatted_desc

    url = f"{_api_base()}/issue"
    logger.info("jira_client create_epic: POST %s", url)
    async with _jira_client() as client:
        epic_name_id = await _get_epic_name_field_id(client)
        if epic_name_id:
            fields[epic_name_id] = summary

        if start_date or cutover_date:
            ids = await _get_target_date_field_ids(client)
            if start_date and ids.get("start"):
                fields[ids["start"]] = start_date
            if cutover_date and ids.get("end"):
                fields[ids["end"]] = cutover_date

        response = await client.post(url, json={"fields": fields})
        logger.info("jira_client create_epic: response status=%d", response.status_code)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_with_body(exc)
        return response.json()["key"]


async def create_story(
    project_key: str,
    summary: str,
    parent_epic_key: str,
    description: dict | None = None,
) -> str:
    """
    Create a Jira Story linked to a parent Epic via the Jira REST API.
    Returns the story key (e.g. "MIG-101").
    Raises ValueError if Jira is not configured.
    Raises httpx.HTTPStatusError on Jira API failure.
    """
    if not settings.jira_base_url:
        raise ValueError("Jira not configured")

    fields: dict = {
        "project": {"key": project_key},
        "issuetype": {"name": "Story"},
        "summary": summary,
        "parent": {"key": parent_epic_key},
    }

    formatted_desc = _format_description(description)
    if formatted_desc:
        fields["description"] = formatted_desc

    url = f"{_api_base()}/issue"
    logger.info("jira_client create_story: POST %s", url)
    async with _jira_client() as client:
        response = await client.post(url, json={"fields": fields})
        logger.info("jira_client create_story: response status=%d", response.status_code)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_with_body(exc)
        return response.json()["key"]


async def create_subtask(
    project_key: str,
    summary: str,
    parent_story_key: str,
    description: dict | None = None,
) -> str:
    """
    Create a Jira child issue linked to a parent Story via the Jira REST API.
    Returns the subtask key (e.g. "MIG-102").

    Issue type resolution (most reliable first):
      1. JIRA_SUBTASK_ISSUE_TYPE_ID — use numeric ID directly (immune to name typos)
      2. JIRA_SUBTASK_ISSUE_TYPE    — use name string (default: "Subtask")

    Raises ValueError if Jira is not configured.
    Raises httpx.HTTPStatusError on Jira API failure (response body included in message).
    """
    if not settings.jira_base_url:
        raise ValueError("Jira not configured")

    # Prefer ID-based resolution; fall back to name.
    if settings.jira_subtask_issue_type_id:
        issuetype: dict = {"id": settings.jira_subtask_issue_type_id}
    else:
        issuetype = {"name": settings.jira_subtask_issue_type}

    fields: dict = {
        "project": {"key": project_key},
        "issuetype": issuetype,
        "summary": summary,
        "parent": {"key": parent_story_key},
    }

    formatted_desc = _format_description(description)
    if formatted_desc:
        fields["description"] = formatted_desc

    url = f"{_api_base()}/issue"
    logger.info("jira_client create_subtask: POST %s", url)
    async with _jira_client() as client:
        response = await client.post(url, json={"fields": fields})
        logger.info("jira_client create_subtask: response status=%d", response.status_code)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_with_body(exc)
        return response.json()["key"]


async def create_issue_link(outward_key: str, inward_key: str, link_type: str) -> None:
    """
    Create a Jira issue link between two issues via the Jira REST API.

    The link reads: outward_key <link_type> inward_key.
    e.g. "MIG-105 Delivers MIG-102"

    Raises ValueError if Jira is not configured.
    Raises httpx.HTTPStatusError on Jira API failure.
    """
    if not settings.jira_base_url:
        raise ValueError("Jira not configured")

    url = f"{_api_base()}/issueLink"
    body = {
        "type": {"name": link_type},
        "outwardIssue": {"key": outward_key},
        "inwardIssue": {"key": inward_key},
    }
    logger.info("jira_client create_issue_link: POST %s (%s -> %s)", url, outward_key, inward_key)
    async with _jira_client() as client:
        response = await client.post(url, json=body)
        logger.info("jira_client create_issue_link: response status=%d", response.status_code)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_with_body(exc)


async def get_epic(epic_key: str) -> dict:
    """
    Get a Jira Epic via the Jira REST API.
    Returns a dictionary of mapped wave fields.
    Raises ValueError if Jira is not configured.
    Raises httpx.HTTPStatusError on Jira API failure.
    """
    if not settings.jira_base_url:
        raise ValueError("Jira not configured")

    url = f"{_api_base()}/issue/{epic_key}"
    logger.info("jira_client get_epic: GET %s", url)
    async with _jira_client() as client:
        response = await client.get(url)
        logger.info("jira_client get_epic: response status=%d", response.status_code)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_with_body(exc)

        issue = response.json()

        ids = await _get_target_date_field_ids(client)
        target_start_id = ids.get("start")
        target_end_id = ids.get("end")
        epic_name_id = await _get_epic_name_field_id(client)

        fields = issue.get("fields", {})

        description = fields.get("description")
        if description is None:
            description = ""
        elif isinstance(description, dict):
            description = _adf_to_text(description)
        elif not isinstance(description, str):
            description = str(description)

        summary = fields.get("summary", "")
        epic_name = fields.get(epic_name_id) if epic_name_id else None
        name = epic_name or summary

        start_date = fields.get(target_start_id) if target_start_id else None
        cutover_date = fields.get(target_end_id) if target_end_id else None

        status_category = (
            fields.get("status", {}).get("statusCategory", {}).get("name", "") or ""
        )

        return {
            "name": name,
            "description": description,
            "start_date": start_date,
            "cutover_date": cutover_date,
            "jira_project_key": fields.get("project", {}).get("key"),
            "jira_status_category": status_category,
        }


async def get_transitions(issue_key: str) -> list[dict]:
    """
    Return available transitions for a Jira issue via the REST API.
    Raises ValueError if Jira is not configured.
    Raises httpx.HTTPStatusError on Jira API failure.
    """
    if not settings.jira_base_url:
        raise ValueError("Jira not configured")

    url = f"{_api_base()}/issue/{issue_key}/transitions"
    logger.info("jira_client get_transitions: GET %s", url)
    async with _jira_client() as client:
        response = await client.get(url)
        logger.info("jira_client get_transitions: response status=%d", response.status_code)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_with_body(exc)
        return response.json().get("transitions", [])


def get_done_transition_id(transitions: list[dict]) -> str | None:
    """
    Scan transition list for one whose target status name is 'Done'.
    Falls back to 'Closed' or 'Resolved' if 'Done' is not found.
    Returns the transition id or None.
    """
    for name in ("Done", "Closed", "Resolved"):
        for t in transitions:
            if t.get("to", {}).get("name") == name:
                return t.get("id")
    return None


async def transition_issue(
    issue_key: str,
    transition_id: str,
) -> None:
    """
    Transition a Jira issue via the REST API.
    Raises ValueError if Jira is not configured.
    Raises httpx.HTTPStatusError on Jira API failure.
    """
    if not settings.jira_base_url:
        raise ValueError("Jira not configured")

    body: dict = {"transition": {"id": transition_id}}

    url = f"{_api_base()}/issue/{issue_key}/transitions"
    logger.info("jira_client transition_issue: POST %s transition=%s", url, transition_id)
    async with _jira_client() as client:
        response = await client.post(url, json=body)
        logger.info("jira_client transition_issue: response status=%d", response.status_code)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_with_body(exc)


async def add_comment(issue_key: str, comment: str) -> None:
    """
    Add a comment to a Jira issue via the REST API.
    Raises ValueError if Jira is not configured.
    Raises httpx.HTTPStatusError on Jira API failure.
    """
    if not settings.jira_base_url:
        raise ValueError("Jira not configured")

    body = {
        "body": _format_comment_body(comment)
    }

    url = f"{_api_base()}/issue/{issue_key}/comment"
    logger.info("jira_client add_comment: POST %s", url)
    async with _jira_client() as client:
        response = await client.post(url, json=body)
        logger.info("jira_client add_comment: response status=%d", response.status_code)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_with_body(exc)
