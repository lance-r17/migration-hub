import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


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
        resp = await client.get(f"{settings.jira_base_url}/rest/api/3/field")
        resp.raise_for_status()
        all_fields = resp.json()
        return {
            "start": next((f["id"] for f in all_fields if f["name"].lower() == "target start"), None),
            "end": next((f["id"] for f in all_fields if f["name"].lower() == "target end"), None),
        }
    except Exception as e:
        logger.warning("Failed to fetch Jira target date field IDs: %s", e)
        return {"start": None, "end": None}


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

    async with httpx.AsyncClient(
        auth=httpx.BasicAuth(settings.jira_user_email, settings.jira_api_token),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    ) as client:
        ids = await _get_target_date_field_ids(client)
        fields: dict = {}
        if start_date and ids.get("start"):
            fields[ids["start"]] = start_date
        if end_date and ids.get("end"):
            fields[ids["end"]] = end_date
        if not fields:
            return
        url = f"{settings.jira_base_url}/rest/api/3/issue/{issue_key}"
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
    Create a Jira Epic via the Jira Cloud REST API v3.
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

    if description:
        fields["description"] = {
            "version": 1,
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": description}],
                }
            ],
        }

    url = f"{settings.jira_base_url}/rest/api/3/issue"
    logger.info("jira_client create_epic: POST %s", url)
    async with httpx.AsyncClient(
        auth=httpx.BasicAuth(settings.jira_user_email, settings.jira_api_token),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    ) as client:
        # If dates are provided, resolve target start and target end custom field IDs
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
    Create a Jira Story linked to a parent Epic via the Jira Cloud REST API v3.
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

    if description:
        fields["description"] = description

    url = f"{settings.jira_base_url}/rest/api/3/issue"
    logger.info("jira_client create_story: POST %s", url)
    async with httpx.AsyncClient(
        auth=httpx.BasicAuth(settings.jira_user_email, settings.jira_api_token),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    ) as client:
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
    Create a Jira child issue linked to a parent Story via the Jira Cloud REST API v3.
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

    if description:
        fields["description"] = description

    url = f"{settings.jira_base_url}/rest/api/3/issue"
    logger.info("jira_client create_subtask: POST %s", url)
    async with httpx.AsyncClient(
        auth=httpx.BasicAuth(settings.jira_user_email, settings.jira_api_token),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    ) as client:
        response = await client.post(url, json={"fields": fields})
        logger.info("jira_client create_subtask: response status=%d", response.status_code)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_with_body(exc)
        return response.json()["key"]


async def create_issue_link(outward_key: str, inward_key: str, link_type: str) -> None:
    """
    Create a Jira issue link between two issues via the Jira Cloud REST API v3.

    The link reads: outward_key <link_type> inward_key.
    e.g. "MIG-105 Delivers MIG-102"

    Raises ValueError if Jira is not configured.
    Raises httpx.HTTPStatusError on Jira API failure.
    """
    if not settings.jira_base_url:
        raise ValueError("Jira not configured")

    url = f"{settings.jira_base_url}/rest/api/3/issueLink"
    body = {
        "type": {"name": link_type},
        "outwardIssue": {"key": outward_key},
        "inwardIssue": {"key": inward_key},
    }
    logger.info("jira_client create_issue_link: POST %s (%s -> %s)", url, outward_key, inward_key)
    async with httpx.AsyncClient(
        auth=httpx.BasicAuth(settings.jira_user_email, settings.jira_api_token),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    ) as client:
        response = await client.post(url, json=body)
        logger.info("jira_client create_issue_link: response status=%d", response.status_code)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_with_body(exc)


async def get_epic(epic_key: str) -> dict:
    """
    Get a Jira Epic via the Jira Cloud REST API v2.
    Returns a dictionary of mapped wave fields.
    Raises ValueError if Jira is not configured.
    Raises httpx.HTTPStatusError on Jira API failure.
    """
    if not settings.jira_base_url:
        raise ValueError("Jira not configured")

    url = f"{settings.jira_base_url}/rest/api/2/issue/{epic_key}"
    logger.info("jira_client get_epic: GET %s", url)
    async with httpx.AsyncClient(
        auth=httpx.BasicAuth(settings.jira_user_email, settings.jira_api_token),
        headers={"Accept": "application/json"},
    ) as client:
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

        fields = issue.get("fields", {})
        
        description = fields.get("description")
        if description is None:
            description = ""
        elif not isinstance(description, str):
            description = str(description)
            
        summary = fields.get("summary", "")
        
        start_date = fields.get(target_start_id) if target_start_id else None
        cutover_date = fields.get(target_end_id) if target_end_id else None

        status_category = (
            fields.get("status", {}).get("statusCategory", {}).get("name", "") or ""
        )

        return {
            "name": summary,
            "description": description,
            "start_date": start_date,
            "cutover_date": cutover_date,
            "jira_project_key": fields.get("project", {}).get("key"),
            "jira_status_category": status_category,
        }
