#!/usr/bin/env python3
"""Seed the database with mock data from scripts/seed_data/*.json.

Usage:
    python scripts/seed.py            # skip if already seeded
    python scripts/seed.py --force    # clear and re-seed everything
    python scripts/seed.py --projects --waves   # refresh only projects and waves
    python scripts/seed.py --config   # refresh all config data
    python scripts/seed.py --config-migration-settings   # refresh only migration settings
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
    NoteTemplate,
    NoteTemplateVersion,
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


def _clear_table(session: Session, table: str) -> None:
    session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))


def seed_users(session: Session) -> None:
    print("Seeding users...")
    for u in load("users.json"):
        existing = session.get(User, u["id"])
        if not existing:
            session.add(User(**{k: v for k, v in u.items() if v is not None or k in ("team", "role")}))


def seed_waves(session: Session) -> None:
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


def seed_projects(session: Session) -> None:
    print("Seeding projects, resources, risks, approvals...")
    for p in load("projects.json"):
        survey_submitted_at = p.get("survey_submitted_at")
        if survey_submitted_at:
            survey_submitted_at = datetime.fromisoformat(survey_submitted_at.replace("Z", "+00:00"))

        project = Project(
            id=p["id"],
            name=p["name"],
            status=p["status"],
            description=p.get("description"),
            migration_wave=p.get("migration_wave"),
            wave_id=p.get("wave_id"),
            application_overview=p.get("application_overview"),
            availability=p.get("availability"),
            data_persistence=p.get("data_persistence"),
            dependencies=p.get("dependencies"),
            nfrs=p.get("nfrs"),
            migration_constraints=p.get("migration_constraints"),
            target_architecture=p.get("target_architecture"),
            planning=p.get("planning"),
            survey_submitted_at=survey_submitted_at,
            jira_story_key=p.get("jira_story_key"),
            jira_job_status=p.get("jira_job_status"),
        )
        session.add(project)
        session.flush()

        # Cloud resources
        for r in p.get("resources", []):
            session.add(CloudResource(
                resource_id=r["resource_id"],
                project_id=p["id"],
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
            if session.get(User, user_id):
                existing_pu = session.get(ProjectUser, (p["id"], user_id))
                if not existing_pu:
                    session.add(ProjectUser(project_id=p["id"], user_id=user_id))

        # Sync ITSO role from seed data
        itso_uid = p.get("itso")
        if itso_uid and session.get(User, itso_uid):
            existing_pu = session.get(ProjectUser, (p["id"], itso_uid))
            if existing_pu:
                roles = {r.strip() for r in (existing_pu.role or "").split(",") if r.strip()}
                roles.add("itso")
                existing_pu.role = ",".join(sorted(roles))
            else:
                session.add(ProjectUser(project_id=p["id"], user_id=itso_uid, role="itso"))

        # Sync governance roles from governance_roles into project_users
        gr = p.get("governance_roles", {})
        for role, uid in (
            ("technical_lead", gr.get("technical_lead")),
            ("business_owner", gr.get("business_owner")),
            ("dba_data_owner", gr.get("dba_data_owner")),
        ):
            if uid and session.get(User, uid):
                existing_pu = session.get(ProjectUser, (p["id"], uid))
                if existing_pu:
                    roles = {r.strip() for r in (existing_pu.role or "").split(",") if r.strip()}
                    roles.discard("member")
                    roles.add(role)
                    existing_pu.role = ",".join(sorted(roles))
                else:
                    session.add(ProjectUser(project_id=p["id"], user_id=uid, role=role))


def seed_embargos(session: Session) -> None:
    print("Seeding embargos...")
    for e in load("embargos.json"):
        session.add(EmbargoRecord(
            id=e["id"],
            name=e["name"],
            start_date=e["start_date"],
            end_date=e["end_date"],
            affected_service_lines=e.get("affected_service_lines", []),
        ))


def seed_billing(session: Session) -> None:
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


def seed_config(session: Session, keys: list[str] | None = None) -> None:
    CONFIG_FILES: dict[str, tuple[str, str]] = {
        "survey_config": ("survey_config.json", "survey_config"),
        "resource_survey_config": ("resource_survey_config.json", "resource_survey_config"),
        "billing_threshold_config": ("billing_config.json", "billing_threshold_config"),
        "migration_settings": ("migration_settings.json", "migration_settings"),
        "bgi_hierarchy": ("bgi_hierarchy.json", "bgi_hierarchy"),
    }
    to_seed = keys if keys else list(CONFIG_FILES.keys())
    for key in to_seed:
        if key not in CONFIG_FILES:
            print(f"Warning: unknown config key '{key}', skipping.")
            continue
        filename, store_key = CONFIG_FILES[key]
        print(f"Seeding config: {store_key}...")
        data = load(filename)
        existing = session.get(ConfigStore, store_key)
        if existing:
            existing.value = data
        else:
            session.add(ConfigStore(key=store_key, value=data))


def seed_email_templates(session: Session) -> None:
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
                html_snapshot=t.get("html_snapshot"),
                is_predefined=t.get("is_predefined", False),
            ))


def seed_note_templates(session: Session) -> None:
    print("Seeding note templates...")
    data = load("note_templates.json")

    for t in data.get("templates", []):
        existing = session.get(NoteTemplate, t["id"])
        if not existing:
            session.add(NoteTemplate(
                id=t["id"],
                name=t["name"],
                description=t.get("description"),
                labels=t.get("labels", []),
                blocks=t.get("blocks", []),
                scope=t.get("scope", "private"),
                shared_roles=t.get("shared_roles", []),
                created_by=t.get("created_by"),
                created_at=datetime.fromisoformat(t["created_at"].replace("Z", "+00:00")) if t.get("created_at") else None,
                updated_at=datetime.fromisoformat(t["updated_at"].replace("Z", "+00:00")) if t.get("updated_at") else None,
            ))

    for v in data.get("versions", []):
        existing = session.get(NoteTemplateVersion, v["id"])
        if not existing:
            session.add(NoteTemplateVersion(
                id=v["id"],
                template_id=v["template_id"],
                version_number=v["version_number"],
                name=v["name"],
                description=v.get("description"),
                labels=v.get("labels", []),
                blocks=v.get("blocks", []),
                scope=v.get("scope", "private"),
                shared_roles=v.get("shared_roles", []),
                created_by=v.get("created_by"),
                created_at=datetime.fromisoformat(v["created_at"].replace("Z", "+00:00")) if v.get("created_at") else None,
            ))


def _seed_all(session: Session) -> None:
    seed_users(session)
    seed_waves(session)
    session.flush()
    seed_projects(session)
    session.flush()
    seed_embargos(session)
    seed_billing(session)
    seed_config(session)
    seed_email_templates(session)
    seed_note_templates(session)
    session.commit()
    print("Seed complete.")


def seed(
    session: Session,
    force: bool = False,
    targets: dict[str, bool] | None = None,
    config_targets: dict[str, bool] | None = None,
    config_all: bool = False,
) -> None:
    # Determine which entities to seed
    all_targets = {
        "users": True,
        "waves": True,
        "projects": True,
        "embargos": True,
        "billing": True,
        "config": True,
        "email_templates": True,
        "note_templates": True,
    }
    active = {k: v for k, v in (targets or {}).items() if v} or all_targets
    has_selective = bool(targets and any(targets.values()))

    # Guard: skip if already seeded (unless force or selective flags are used)
    if not force and not has_selective:
        count = session.execute(text("SELECT COUNT(*) FROM users")).scalar()
        if count:
            print(f"Database already has {count} users. Use --force to re-seed.")
            return

    # Clear tables
    if force or has_selective:
        print("Force mode: clearing existing data..." if force else "Selective refresh: clearing requested tables...")
        if has_selective:
            if active.get("users"):
                _clear_table(session, "users")
            if active.get("waves"):
                _clear_table(session, "waves")
            if active.get("projects"):
                _clear_table(session, "cloud_resources")
                _clear_table(session, "project_users")
                _clear_table(session, "approvals")
                _clear_table(session, "risks")
                _clear_table(session, "projects")
            if active.get("embargos"):
                _clear_table(session, "embargo_records")
            if active.get("billing"):
                _clear_table(session, "billing_records")
            if active.get("config") and force:
                if not config_all and config_targets and any(config_targets.values()):
                    for key, selected in config_targets.items():
                        if selected:
                            session.execute(text("DELETE FROM config_store WHERE key = :key"), {"key": key})
                else:
                    _clear_table(session, "config_store")
            if active.get("email_templates"):
                _clear_table(session, "email_templates")
            if active.get("note_templates"):
                _clear_table(session, "note_template_versions")
                _clear_table(session, "note_templates")
        else:
            for table in [
                "jira_jobs", "audit_log_entries", "approvals", "risks",
                "cloud_resources", "project_users", "projects", "waves",
                "users", "embargo_records", "billing_records", "config_store",
                "email_templates", "note_template_versions", "note_templates",
            ]:
                _clear_table(session, table)
        session.flush()

    # Seed requested entities
    if active.get("users"):
        seed_users(session)
    if active.get("waves"):
        seed_waves(session)
    if active.get("projects"):
        seed_projects(session)
    if active.get("embargos"):
        seed_embargos(session)
    if active.get("billing"):
        seed_billing(session)
    if active.get("config"):
        if not config_all and config_targets and any(config_targets.values()):
            seed_config(session, keys=[k for k, v in config_targets.items() if v])
        else:
            seed_config(session)
    if active.get("email_templates"):
        seed_email_templates(session)
    if active.get("note_templates"):
        seed_note_templates(session)

    session.commit()
    print("Seed complete.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Migration Engine database")
    parser.add_argument("--force", action="store_true", help="Clear and re-seed even if data exists")
    parser.add_argument("--users", action="store_true", help="Refresh users only")
    parser.add_argument("--waves", action="store_true", help="Refresh waves only")
    parser.add_argument("--projects", action="store_true", help="Refresh projects only")
    parser.add_argument("--embargos", action="store_true", help="Refresh embargos only")
    parser.add_argument("--billing", action="store_true", help="Refresh billing records only")
    parser.add_argument("--config", action="store_true", help="Refresh all config store entries")
    parser.add_argument("--config-survey-config", action="store_true", help="Refresh survey config only")
    parser.add_argument("--config-resource-survey-config", action="store_true", help="Refresh resource survey config only")
    parser.add_argument("--config-billing-threshold-config", action="store_true", help="Refresh billing threshold config only")
    parser.add_argument("--config-migration-settings", action="store_true", help="Refresh migration settings only")
    parser.add_argument("--config-bgi-hierarchy", action="store_true", help="Refresh BGI hierarchy only")
    parser.add_argument("--email-templates", action="store_true", help="Refresh email templates only")
    parser.add_argument("--note-templates", action="store_true", help="Refresh note templates only")
    args = parser.parse_args()

    config_targets = {
        "survey_config": args.config_survey_config,
        "resource_survey_config": args.config_resource_survey_config,
        "billing_threshold_config": args.config_billing_threshold_config,
        "migration_settings": args.config_migration_settings,
        "bgi_hierarchy": args.config_bgi_hierarchy,
    }

    targets = {
        "users": args.users,
        "waves": args.waves,
        "projects": args.projects,
        "embargos": args.embargos,
        "billing": args.billing,
        "config": args.config or any(config_targets.values()),
        "email_templates": args.email_templates,
        "note_templates": args.note_templates,
    }
    has_selective = any(targets.values())

    try:
        engine = create_engine(SYNC_URL, echo=False)
    except Exception:
        print("ERROR: Could not create sync engine. Install psycopg2: pip install psycopg2-binary")
        print(f"DATABASE_URL: {SYNC_URL}")
        sys.exit(1)

    with Session(engine) as session:
        seed(
            session,
            force=args.force,
            targets=targets if has_selective else None,
            config_targets=config_targets,
            config_all=args.config,
        )


if __name__ == "__main__":
    main()
