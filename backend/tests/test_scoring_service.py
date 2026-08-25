"""Parity tests for scoring_service, ported from frontend/scripts/verify-scoring.ts.

Expectations mirror the *current* frontend behavior in frontend/src/lib/scoring.ts
(including commit 8798898: no prod resources -> 'Lightweight').
"""

from types import SimpleNamespace

from app.services.scoring_service import (
    get_infra_footprint_score,
    get_migration_driver_score,
)


def _resource(product="ecs", resource_set="rs-prod", specs=None):
    return SimpleNamespace(product=product, resource_set=resource_set, specs=specs)


def _infra_with_ecs(count: int):
    return [_resource() for _ in range(count)]


# ─── Infra footprint: ECS boundaries ─────────────────────────────────────────


def test_ecs_boundaries():
    assert get_infra_footprint_score(_infra_with_ecs(10))["score"] == "Lightweight"
    assert get_infra_footprint_score(_infra_with_ecs(11))["score"] == "Mid-tier"
    assert get_infra_footprint_score(_infra_with_ecs(30))["score"] == "Large"
    assert get_infra_footprint_score(_infra_with_ecs(31))["score"] == "Extended"


# ─── Infra footprint: data volume boundaries ─────────────────────────────────


def _data_project(tb: float):
    return [_resource(product="rds", specs={"storage_tb": tb})]


def test_data_volume_boundaries():
    assert get_infra_footprint_score(_data_project(0.5))["score"] == "Lightweight"
    assert get_infra_footprint_score(_data_project(1))["score"] == "Mid-tier"
    assert get_infra_footprint_score(_data_project(5))["score"] == "Mid-tier"
    assert get_infra_footprint_score(_data_project(10))["score"] == "Large"
    assert get_infra_footprint_score(_data_project(100))["score"] == "Large"
    assert get_infra_footprint_score(_data_project(101))["score"] == "Extended"


# ─── Infra footprint: MaxCompute boundaries ──────────────────────────────────


def _maxcompute_project(count: int):
    return [_resource(product="maxcompute") for _ in range(count)] + [
        _resource(product="slb")
    ]


def test_maxcompute_boundaries():
    assert get_infra_footprint_score(_maxcompute_project(0))["score"] == "Lightweight"
    assert get_infra_footprint_score(_maxcompute_project(1))["score"] == "Mid-tier"
    assert get_infra_footprint_score(_maxcompute_project(20))["score"] == "Mid-tier"
    assert get_infra_footprint_score(_maxcompute_project(21))["score"] == "Large"
    assert get_infra_footprint_score(_maxcompute_project(50))["score"] == "Large"
    assert get_infra_footprint_score(_maxcompute_project(51))["score"] == "Extended"


# ─── Infra footprint: prod-only scoping ──────────────────────────────────────


def test_dev_only_resources_excluded():
    # No prod resources -> forced 'Lightweight' (mirrors current frontend behavior)
    resources = [_resource(resource_set="rs-dev")]
    result = get_infra_footprint_score(resources)
    assert result["score"] == "Lightweight"
    assert result["ecs_count"] == 0


def test_empty_resources_lightweight():
    result = get_infra_footprint_score([])
    assert result["score"] == "Lightweight"


# ─── Migration driver: tier mapping ──────────────────────────────────────────


def _driver_project(tier=None, iita=False, deps=0, users=0):
    overview = {
        "applicationTier": tier,
        "iitaApplicability": iita,
        "userBase": {"type": "Internal", "count": str(users)},
    }
    dependencies = {
        "upstream": [{"id": f"d-{i}", "name": f"dep-{i}"} for i in range(deps)],
        "downstream": [],
    }
    effort = {"tables": [{"baId": "BA", "tasks": []}]}
    return get_migration_driver_score(overview, effort, dependencies)


def test_tier_mapping():
    assert _driver_project("T3", False, 1, 100)["score"] == "Low"
    assert _driver_project("T2", False, 1, 100)["score"] == "Low"
    assert _driver_project("T2", True, 1, 100)["score"] == "Medium"
    assert _driver_project("T1", False, 1, 100)["score"] == "Medium"
    assert _driver_project("T1", True, 1, 100)["score"] == "High"
    assert _driver_project("T0", False, 1, 100)["score"] == "High"


# ─── Migration driver: numeric boundaries ────────────────────────────────────


def _numeric_driver(third_party=0, deps=0, users=0, apps=1):
    overview = {"userBase": {"type": "External", "count": str(users)}}
    dependencies = {
        "upstream": [{"id": f"d-{i}", "name": f"dep-{i}"} for i in range(deps)],
        "downstream": [],
    }
    effort = {
        "tables": [
            {
                "baId": f"BA-{i}",
                "tasks": [
                    {
                        "effortType": "third_party_services",
                        "effort": third_party,
                        "effortTime": 1,
                        "rate": 1000,
                        "thirdParty": True,
                    }
                ],
            }
            for i in range(apps)
        ]
    }
    return get_migration_driver_score(overview, effort, dependencies)


def test_third_party_levels():
    assert _numeric_driver(third_party=2)["third_party_level"] == "Low"
    assert _numeric_driver(third_party=3)["third_party_level"] == "Medium"
    assert _numeric_driver(third_party=5)["third_party_level"] == "High"


def test_dependency_levels():
    assert _numeric_driver(deps=4)["dependency_level"] == "Low"
    assert _numeric_driver(deps=5)["dependency_level"] == "Medium"
    assert _numeric_driver(deps=11)["dependency_level"] == "High"


def test_external_user_levels():
    assert _numeric_driver(users=1000)["external_user_level"] == "Low"
    assert _numeric_driver(users=1001)["external_user_level"] == "Medium"
    assert _numeric_driver(users=10001)["external_user_level"] == "High"


def test_app_count_levels():
    assert _numeric_driver(apps=1)["app_level"] == "Low"
    assert _numeric_driver(apps=2)["app_level"] == "Medium"
    assert _numeric_driver(apps=6)["app_level"] == "High"


# ─── Number parsing (K/M/B suffixes) ─────────────────────────────────────────


def test_user_base_suffix_parsing():
    result = get_migration_driver_score(
        {"userBase": {"type": "External", "count": "2.5K"}},
        None,
        None,
    )
    assert result["external_user_count"] == 2500
    assert result["external_user_level"] == "Medium"


def test_missing_tier_is_low():
    result = get_migration_driver_score(None, None, None)
    assert result["score"] == "Low"
    assert result["tier_level"] == "Low"
