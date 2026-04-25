#!/usr/bin/env python3
"""
Seed the database with mock data from scripts/seed_data/*.json.

Usage:
    python scripts/seed.py            # skip if already seeded
    python scripts/seed.py --force    # clear and re-seed
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running from backend/ root
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (  # noqa: F401 — ensure all models are registered
    Approval,
    AuditLogEntry,
    Base,
    BillingRecord,
    CloudResource,
    ConfigStore,
    EmailTemplate,
    EmbargoRecord,
    JiraJob,
    Project,
    ProjectUser,
    Risk,
    User,
    Wave,
)

DATA_DIR = Path(__file__).parent / "seed_data"

# Use sync engine for seed script (simpler than async)
SYNC_URL = settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


def load(filename: str) -> dict | list:
    with open(DATA_DIR / filename) as f:
        return json.load(f)


def seed(session: Session, force: bool = False) -> None:
    # Check if already seeded
    count = session.execute(text("SELECT COUNT(*) FROM users")).scalar()
    if count and not force:
        print(f"Database already has {count} users. Use --force to re-seed.")
        return

    if force:
        print("Force mode: clearing existing data...")
        # Delete in reverse FK order
        for table in [
            "jira_jobs", "audit_log_entries", "approvals", "risks",
            "cloud_resources", "project_users", "projects", "waves",
            "users", "embargo_records", "billing_records", "config_store",
            "email_templates",
        ]:
            session.execute(text(f"DELETE FROM {table}"))
        session.flush()

    print("Seeding users...")
    users_data = load("users.json")
    for u in users_data:
        # Skip duplicate u-current (same email as u9 in mock)
        existing = session.get(User, u["id"])
        if not existing:
            session.add(User(**{k: v for k, v in u.items() if v is not None or k in ("team", "role")}))

    print("Seeding waves...")
    for w in load("waves.json"):
        session.add(Wave(
            id=w["id"],
            name=w["name"],
            start_date=w["start_date"],
            cutover_date=w["cutover_date"],
            description=w.get("description"),
            jira_project_key=w["jira_project_key"],
            jira_epic_key=w.get("jira_epic_key"),
            source=w.get("source", "created"),
            status=w.get("status", "planned"),
        ))

    session.flush()

    print("Seeding projects, resources, risks, approvals...")
    for p in load("projects.json"):
        project = Project(
            id=p["id"],
            name=p["name"],
            status=p["status"],
            description=p.get("description"),
            migration_wave=p.get("migration_wave"),
            profile_owner=p.get("profile_owner"),
            jira_ticket=p.get("jira_ticket"),
            jira_base_url=p.get("jira_base_url"),
            wave_id=p.get("wave_id"),
            application_overview=p.get("application_overview"),
            availability=p.get("availability"),
            data_persistence=p.get("data_persistence"),
            dependencies=p.get("dependencies"),
            nfrs=p.get("nfrs"),
            migration_constraints=p.get("migration_constraints"),
            target_architecture=p.get("target_architecture"),
        )
        session.add(project)
        session.flush()

        # Cloud resources
        for r in p.get("resources", []):
            session.add(CloudResource(
                id=r["id"],
                project_id=p["id"],
                resource_id=r.get("resource_id"),
                name=r["name"],
                product=r.get("product"),
                resource_set=r.get("resource_set"),
                specs=r.get("specs"),
                sub_application=r.get("sub_application"),
                target_resource_id=r.get("target_resource_id"),
                sync_status=r.get("sync_status", "out-of-sync"),
                need_migration=r.get("need_migration", True),
            ))

        # Risks
        for risk in p.get("risks", []):
            session.add(Risk(
                id=risk["id"],
                project_id=p["id"],
                title=risk["title"],
                description=risk.get("description", ""),
                severity=risk.get("severity", "medium"),
                mitigation=risk.get("mitigation"),
                owner=risk.get("owner"),
                risk_status=risk.get("risk_status"),
            ))

        # Approvals
        for a in p.get("approvals", []):
            session.add(Approval(
                id=a["id"],
                project_id=p["id"],
                role=a["role"],
                approver=a.get("approver"),
                status=a.get("status", "pending"),
                timestamp=a.get("timestamp"),
                icon=a.get("icon", ""),
                user_id=a.get("user_id"),
            ))

        # Project users
        for user_id in p.get("project_users", []):
            # Check user exists before creating association
            if session.get(User, user_id):
                existing_pu = session.get(ProjectUser, (p["id"], user_id))
                if not existing_pu:
                    session.add(ProjectUser(project_id=p["id"], user_id=user_id))

        # Sync governance roles from applicationOverview into project_users
        _GOVERNANCE_ROLE_FIELDS = {
            "technicalLeadId": "technical_lead",
            "businessOwnerId": "business_owner",
            "dbaDataOwnerId": "dba_data_owner",
        }
        ao = p.get("application_overview", {})
        for field, role in _GOVERNANCE_ROLE_FIELDS.items():
            uid = ao.get(field)
            if uid and session.get(User, uid):
                existing_pu = session.get(ProjectUser, (p["id"], uid))
                if existing_pu:
                    existing_pu.role = role
                else:
                    session.add(ProjectUser(project_id=p["id"], user_id=uid, role=role))

    session.flush()

    print("Seeding embargos...")
    for e in load("embargos.json"):
        session.add(EmbargoRecord(
            id=e["id"],
            name=e["name"],
            start_date=e["start_date"],
            end_date=e["end_date"],
            affected_service_lines=e.get("affected_service_lines", []),
        ))

    print("Seeding billing records...")
    billing = load("billing.json")
    for env, months in [("existing", billing["existing"]), ("target", billing["target"])]:
        for month, records in months.items():
            for rec in records:
                session.add(BillingRecord(
                    month=month,
                    env=env,
                    resource_set=rec["resource_set"],
                    amount=rec["amount"],
                ))

    print("Seeding config store (survey, billing thresholds)...")
    survey = load("survey_config.json")
    session.add(ConfigStore(key="survey_config", value=survey))

    resource_survey = load("resource_survey_config.json")
    session.add(ConfigStore(key="resource_survey_config", value=resource_survey))

    billing_config = load("billing_config.json")
    session.add(ConfigStore(key="billing_threshold_config", value=billing_config))

    print("Seeding email templates...")
    for t in load("email_templates.json"):
        existing = session.get(EmailTemplate, t["id"])
        if not existing:
            session.add(EmailTemplate(
                id=t["id"],
                name=t["name"],
                description=t.get("description"),
                event_type=t["event_type"],
                subject=t["subject"],
                recipient_list=t.get("recipient_list", []),
                template_style=t.get("template_style", {}),
                rows=t.get("rows", []),
                is_predefined=t.get("is_predefined", False),
            ))

    session.commit()
    print("Seed complete.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Migration Hub database")
    parser.add_argument("--force", action="store_true", help="Clear and re-seed even if data exists")
    args = parser.parse_args()

    try:
        engine = create_engine(SYNC_URL, echo=False)
    except Exception:
        # Fallback: try asyncpg URL directly (will fail gracefully with a clear message)
        print("ERROR: Could not create sync engine. Install psycopg2: pip install psycopg2-binary")
        print(f"DATABASE_URL: {SYNC_URL}")
        sys.exit(1)

    with Session(engine) as session:
        seed(session, force=args.force)


if __name__ == "__main__":
    main()
