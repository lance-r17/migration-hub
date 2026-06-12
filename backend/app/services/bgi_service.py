from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.config_store import ConfigStore
from app.models.project import Project
from app.schemas.bgi import BgiNode

_KEY = "bgi_hierarchy"


def _collect_ids(node: dict[str, Any]) -> list[str]:
    ids = [node["id"]]
    for child in node.get("children") or []:
        ids.extend(_collect_ids(child))
    return ids


def _find_node(node: dict[str, Any], node_id: str) -> dict[str, Any] | None:
    if node.get("id") == node_id:
        return node
    for child in node.get("children") or []:
        found = _find_node(child, node_id)
        if found:
            return found
    return None


def _node_to_dict(node: BgiNode) -> dict[str, Any]:
    data: dict[str, Any] = {"id": node.id, "name": node.name}
    if node.children:
        data["children"] = [_node_to_dict(c) for c in node.children]
    return data


async def get_hierarchy(session: AsyncSession) -> dict[str, Any] | None:
    row = await session.get(ConfigStore, _KEY)
    if not row:
        return None
    return row.value


async def set_hierarchy(session: AsyncSession, root: BgiNode) -> dict[str, Any]:
    row = await session.get(ConfigStore, _KEY)
    data = _node_to_dict(root)
    if row:
        row.value = data
        flag_modified(row, "value")
    else:
        row = ConfigStore(key=_KEY, value=data)
        session.add(row)
    await session.flush()
    return data


async def get_descendant_ids(session: AsyncSession, node_id: str) -> list[str]:
    """Return the node_id itself plus all descendant ids."""
    hierarchy = await get_hierarchy(session)
    if not hierarchy:
        return [node_id]
    node = _find_node(hierarchy, node_id)
    if not node:
        return [node_id]
    return _collect_ids(node)


async def get_descendant_ids_for_multiple(session: AsyncSession, node_ids: list[str]) -> list[str]:
    """Return the union of node_ids and all their descendant ids, deduplicated."""
    hierarchy = await get_hierarchy(session)
    if not hierarchy:
        return list(dict.fromkeys(node_ids))
    result: list[str] = []
    seen = set()
    for node_id in node_ids:
        if node_id in seen:
            continue
        node = _find_node(hierarchy, node_id)
        if node:
            for nid in _collect_ids(node):
                if nid not in seen:
                    seen.add(nid)
                    result.append(nid)
        else:
            if node_id not in seen:
                seen.add(node_id)
                result.append(node_id)
    return result


async def assign_projects_to_bgi(
    session: AsyncSession, bgi_id: str, project_ids: list[str]
) -> None:
    for pid in project_ids:
        project = await session.get(Project, pid)
        if project:
            project.bgi_id = bgi_id
    await session.flush()


async def unassign_projects_from_bgi(
    session: AsyncSession, project_ids: list[str]
) -> None:
    for pid in project_ids:
        project = await session.get(Project, pid)
        if project:
            project.bgi_id = None
    await session.flush()
