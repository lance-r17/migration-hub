"""Unit tests for configurable progress weights and milestone-duration stats.

compute_stage_progress and milestone_stats only touch plain attributes, so a
SimpleNamespace stand-in is enough — no database required.
"""

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.schemas.migration_settings import ProgressWeights
from app.services import milestone_stats
from app.services.project_service import compute_stage_progress


def _resource(need_migration=True, migration_completed=False):
    return SimpleNamespace(need_migration=need_migration, migration_completed=migration_completed)


def _user(role="technical_lead"):
    return SimpleNamespace(role=role)


def _approval(role, status):
    return SimpleNamespace(role=role, status=status)


def _make_project(**overrides):
    base = dict(
        id="PRJ-1",
        cloud_resources=[_resource()],
        project_users=[_user()],
        approvals=[],
        is_survey_needed=True,
        survey_submitted_at=None,
        planning=None,
        environment_provision=None,
        data_migration_plan=None,
        data_migration_schedule=None,
        category_milestones=[],
    )
    base.update(overrides)
    return SimpleNamespace(**base)


# ─── Weighted overall ─────────────────────────────────────────────────────────


def test_default_weights_reproduce_legacy_split():
    # Defaults: preparation 30 (setup 5 / survey 15 / signoff 10), migration 70.
    p = _make_project(survey_submitted_at=datetime.now(timezone.utc))
    stage = compute_stage_progress(p)
    assert stage["setup"] == 100
    assert stage["survey"] == 100
    assert stage["signoff"] == 0
    assert stage["migration"] == 0
    assert stage["overall"] == 20  # 100*5% + 100*15%


def test_custom_weights_applied():
    w = ProgressWeights(preparation=50, setup=20, survey=20, signoff=10)
    p = _make_project(survey_submitted_at=datetime.now(timezone.utc))
    stage = compute_stage_progress(p, w)
    assert stage["overall"] == 40  # 100*20% + 100*20%


def test_migration_weight_is_100_minus_preparation():
    w = ProgressWeights(preparation=40, setup=20, survey=10, signoff=10)
    p = _make_project(
        planning={
            "milestones": [
                {"id": "m1", "start": "2026-01-01", "end": "2026-01-10", "status": "done"},
                {"id": "m2", "start": "2026-01-11", "end": "2026-01-20", "status": "todo"},
            ]
        },
    )
    stage = compute_stage_progress(p, w)
    assert stage["migration"] == 50  # equal durations, half done
    # setup(100)*20% + survey(0) + signoff(0) + migration(50)*60%
    assert stage["overall"] == 20 + 30


def test_survey_not_required_folds_into_setup():
    w = ProgressWeights(preparation=30, setup=5, survey=15, signoff=10)
    p = _make_project(is_survey_needed=False)
    stage = compute_stage_progress(p, w)
    assert stage["survey"] == 100  # treated complete
    # effective setup weight = 5 + 15 = 20, survey weight 0
    assert stage["overall"] == 20


def test_signoff_disabled_folds_into_setup():
    w = ProgressWeights(preparation=30, setup=5, survey=15, signoff=10)
    p = _make_project(survey_submitted_at=datetime.now(timezone.utc))
    stage = compute_stage_progress(p, w, signoff_enabled=False)
    assert stage["signoff"] == 100  # treated complete
    # effective setup weight = 5 + 10 = 15, survey 15
    assert stage["overall"] == 15 + 15


def test_no_milestones_means_zero_migration():
    p = _make_project()
    assert compute_stage_progress(p)["migration"] == 0


# ─── Milestone duration stats ─────────────────────────────────────────────────


def test_duration_is_inclusive_of_end_date():
    assert milestone_stats.milestone_duration_days("2026-06-08", "2026-06-15") == 8
    assert milestone_stats.milestone_duration_days("2026-06-08", "2026-06-08") == 1


def test_stats_include_env_provision_and_dm_period():
    p = _make_project(
        environment_provision={"dev": {"date": "2026-01-01", "completedAt": "2026-01-02"}},
        data_migration_plan={"startDate": "2026-02-01", "endDate": "2026-02-10", "completedAt": None},
    )
    stats = milestone_stats.project_milestone_duration_stats(p)
    assert stats == (11, 1)  # 1-day env (done) + 10-day DM period (todo)


def test_category_milestone_overrides_win():
    cm = SimpleNamespace(
        id="cm-1",
        name="CM",
        start_date="2026-03-01",
        end_date="2026-03-05",
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    p = _make_project(
        category_milestones=[cm],
        planning={"categoryMilestoneOverrides": {"cm-1": {"start": "2026-03-01", "end": "2026-03-10", "status": "done"}}},
    )
    stats = milestone_stats.project_milestone_duration_stats(p)
    assert stats == (10, 10)


# ─── Schema validation ────────────────────────────────────────────────────────


def test_weights_must_sum_to_preparation():
    with pytest.raises(ValueError):
        ProgressWeights(preparation=30, setup=5, survey=15, signoff=5)
