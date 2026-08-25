"""Scoring logic for Infra Footprint and Migration Driver.

Faithful Python port of ``frontend/src/lib/scoring.ts`` so the projects table
endpoint can ship precomputed scores instead of raw resources/dependencies.
Keep behavior in sync with the frontend module when either changes.
"""

import re
from typing import Any, Iterable

from app.services.product_category_service import get_category_for_product

InfraFootprintLevel = str  # 'Lightweight' | 'Mid-tier' | 'Large' | 'Extended'
MigrationDriverLevel = str  # 'Low' | 'Medium' | 'High'

_INFRA_ORDER = ["Lightweight", "Mid-tier", "Large", "Extended"]
_DRIVER_ORDER = ["Low", "Medium", "High"]

_NUMBER_RE = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(K|M|B)?", re.IGNORECASE)


def _parse_first_number(value: Any) -> float | None:
    if value is None:
        return None
    match = _NUMBER_RE.search(str(value))
    if not match:
        return None
    num = float(match.group(1).replace(",", ""))
    suffix = (match.group(2) or "").upper()
    if suffix == "K":
        return num * 1_000
    if suffix == "M":
        return num * 1_000_000
    if suffix == "B":
        return num * 1_000_000_000
    return num


def _parse_tb_from_specs(specs: dict | None) -> float:
    if not specs:
        return 0.0
    total = 0.0
    for key, value in specs.items():
        lower = key.lower()
        num = _parse_first_number(value)
        if num is None:
            continue
        if lower.endswith("_tb") or lower in ("capacity_tb", "storage_tb", "size_tb"):
            total += num
        elif lower.endswith("_gb") or lower in ("capacity_gb", "storage_gb", "size_gb"):
            total += num / 1024
    return total


def _is_prod_resource(resource: Any) -> bool:
    resource_set = getattr(resource, "resource_set", None)
    return bool(resource_set) and resource_set.endswith("-prod")


def _ecs_level(count: int) -> str | None:
    if count <= 0:
        return None
    if count <= 10:
        return "Lightweight"
    if count <= 20:
        return "Mid-tier"
    if count <= 30:
        return "Large"
    return "Extended"


def _maxcompute_level(count: int) -> str:
    if count == 0:
        return "Lightweight"
    if count <= 20:
        return "Mid-tier"
    if count <= 50:
        return "Large"
    return "Extended"


def _data_volume_level(tb: float) -> str:
    if tb < 1:
        return "Lightweight"
    if tb < 10:
        return "Mid-tier"
    if tb <= 100:
        return "Large"
    return "Extended"


def _driver_level(value: float, low_max: float, medium_max: float) -> str | None:
    if value <= 0:
        return None
    if value <= low_max:
        return "Low"
    if value <= medium_max:
        return "Medium"
    return "High"


def _max_level(a: str | None, b: str | None, order: list[str]) -> str | None:
    if not a:
        return b
    if not b:
        return a
    return order[max(order.index(a), order.index(b))]


def get_infra_footprint_score(resources: Iterable[Any]) -> dict[str, Any]:
    """Compute the infra footprint score from cloud resources.

    ``resources`` items must expose ``product``, ``resource_set`` and ``specs``
    attributes (e.g. ``CloudResource`` ORM rows).
    """
    prod_resources = [r for r in resources if _is_prod_resource(r)]

    ecs_count = sum(1 for r in prod_resources if r.product == "ecs")
    maxcompute_count = sum(1 for r in prod_resources if r.product == "maxcompute")

    data_volume_tb = 0.0
    for r in prod_resources:
        category = get_category_for_product(r.product)
        if category != "database" and r.product != "oss":
            continue
        data_volume_tb += _parse_tb_from_specs(r.specs)

    ecs_level = _ecs_level(ecs_count)
    data_volume_level = _data_volume_level(data_volume_tb)
    maxcompute_level = _maxcompute_level(maxcompute_count)

    score: str | None = None
    score = _max_level(score, ecs_level, _INFRA_ORDER)
    score = _max_level(score, data_volume_level, _INFRA_ORDER)
    score = _max_level(score, maxcompute_level, _INFRA_ORDER)

    if not prod_resources:
        score = "Lightweight"

    return {
        "score": score,
        "ecs_count": ecs_count,
        "ecs_level": ecs_level,
        "data_volume_tb": data_volume_tb,
        "data_volume_level": data_volume_level,
        "maxcompute_count": maxcompute_count,
        "maxcompute_level": maxcompute_level,
    }


def _get_tier_level(tier: str | None, iita: bool | None) -> str:
    if not tier:
        return "Low"
    if tier == "T3":
        return "Low"
    if tier == "T2":
        return "Medium" if iita else "Low"
    if tier == "T1":
        return "High" if iita else "Medium"
    if tier == "T0":
        return "High"
    return "Low"


def get_migration_driver_score(
    application_overview: dict | None,
    migration_effort_estimation: dict | None,
    dependencies: dict | None,
) -> dict[str, Any]:
    """Compute the migration driver score from JSONB section dicts."""
    overview = application_overview or {}
    tables = (migration_effort_estimation or {}).get("tables") or []
    deps = dependencies or {}

    application_tier = overview.get("applicationTier")
    iita_applicability = overview.get("iitaApplicability")
    tier_level = _get_tier_level(application_tier, iita_applicability)

    third_party_effort = 0.0
    for table in tables:
        for task in table.get("tasks") or []:
            if task.get("thirdParty"):
                third_party_effort += task.get("effort") or 0
    third_party_level = _driver_level(third_party_effort, 2, 4)

    dependency_count = len(deps.get("upstream") or []) + len(deps.get("downstream") or [])
    dependency_level = _driver_level(dependency_count, 4, 10)

    user_base = overview.get("userBase") or {}
    user_base_count = _parse_first_number(user_base.get("count")) or 0
    user_base_type = user_base.get("type")

    external_user_count = 0.0
    internal_user_count = 0.0
    if user_base_type == "Both":
        external_user_count = user_base_count
        internal_user_count = user_base_count
    elif user_base_type == "External":
        external_user_count = user_base_count
    elif user_base_type == "Internal":
        internal_user_count = user_base_count

    external_user_level = _driver_level(external_user_count, 1000, 10000)
    internal_user_level = _driver_level(internal_user_count, 1000, 5000)

    app_count = len(tables)
    app_level = _driver_level(app_count, 1, 5)

    score: str | None = None
    for level in (
        tier_level,
        third_party_level,
        dependency_level,
        external_user_level,
        internal_user_level,
        app_level,
    ):
        score = _max_level(score, level, _DRIVER_ORDER)

    return {
        "score": score,
        "tier_level": tier_level,
        "application_tier": application_tier,
        "iita_applicability": iita_applicability,
        "third_party_effort": third_party_effort,
        "third_party_level": third_party_level,
        "dependency_count": dependency_count,
        "dependency_level": dependency_level,
        "external_user_count": external_user_count,
        "external_user_level": external_user_level,
        "internal_user_count": internal_user_count,
        "internal_user_level": internal_user_level,
        "app_count": app_count,
        "app_level": app_level,
    }
