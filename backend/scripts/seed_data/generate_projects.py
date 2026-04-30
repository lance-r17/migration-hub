#!/usr/bin/env python3
"""
Generate 200 comprehensive project records for performance testing.

Usage:
    cd backend/scripts/seed_data
    python generate_projects.py

Output:
    Overwrites projects.json with existing 4 projects + 200 generated ones.
"""

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

DATA_DIR = Path(__file__).parent

# ─── Load reference data ─────────────────────────────────────────────────────

with open(DATA_DIR / "users.json") as f:
    USERS = json.load(f)
USER_IDS = [u["id"] for u in USERS if not u["id"].startswith("u-current")]

with open(DATA_DIR / "waves.json") as f:
    WAVES = json.load(f)
WAVE_IDS = [w["id"] for w in WAVES]
WAVE_NAMES = {w["id"]: w["name"] for w in WAVES}

# ─── Constants / Pools ───────────────────────────────────────────────────────

APP_NAMES = [
    "Apollo", "Orion", "Nebula", "Vortex", "Titan", "Zenith", "Quantum",
    "Helix", "Prism", "Fusion", "Nova", "Pulsar", "Cosmos", "Aurora",
    "Stratos", "Eclipse", "Horizon", "Vertex", "Nexus", "Catalyst",
    "Meridian", "Summit", "Delta", "Lambda", "Sigma", "Omega", "Atlas",
    "Phoenix", "Axiom", "Vector", "Matrix", "Cipher", "Flux", "Torus",
    "Arcadia", "Solstice", "Equinox", "Prometheus", "Hyperion", "Chronos",
]

APP_SUFFIXES = [
    "CRM Migration", "ERP Modernization", "Data Warehouse Sync",
    "Analytics Platform", "Auth Service", "Payment Gateway",
    "Log Analytics", "Monitoring Stack", "CI/CD Pipeline",
    "Container Platform", "API Gateway", "CDN Edge",
    "Search Index", "Message Queue", "Cache Layer",
    "File Storage", "DNS Infrastructure", "VPN Gateway",
    "Load Balancer", "Security Scanner", "Backup Service",
    "Identity Provider", "Policy Engine", "Workflow Orchestrator",
    "Stream Processor", "ML Inference", "Data Lake",
    "Feature Store", "Config Management", "Secret Vault",
]

SERVICE_LINES = [
    "Finance & Operations", "Platform Engineering", "Data Engineering",
    "IT Operations", "Platform Security", "Network Operations",
    "Product Management", "Compliance & Risk", "Cloud Architecture",
    "Site Reliability", "Application Security", "DevOps",
    "Network Engineering", "Business Intelligence",
]

MIGRATION_STRATEGIES = ["Lift & Shift", "Refactor", "Deboard"]

APP_TIERS = ["T0", "T1", "T2", "T3"]

PRODUCTS = [
    ("ecs", "computing", {"instance_type": "ecs.c6.xlarge", "cpu": 4, "memory": 16}),
    ("rds", "database", {"instance_type": "rds.mysql.s3.large", "cpu": 4, "memory": 16, "storage_gb": 512}),
    ("oss", "storage", {"capacity_gb": 500, "tier": "standard", "redundancy": "local"}),
    ("slb", "networking", {"mode": "active-passive", "throughput_gbps": 5}),
    ("vpc", "networking", {"cidr": "10.0.0.0/16", "subnets": 6}),
    ("kms", "security", {"key_count": 4, "hsm_backed": False}),
    ("r-kvstore", "database", {"engine": "redis", "version": "7.0", "memory_gb": 8}),
    ("polardb", "database", {"instance_type": "polar.mysql.x4.large", "cpu": 16, "memory": 128, "storage_gb": 2048}),
    ("ess", "computing", {"min_instances": 2, "max_instances": 10, "cooldown_seconds": 300}),
    ("cs", "computing", {"node_count": 4, "instance_type": "ecs.c6.xlarge", "k8s_version": "1.28"}),
    ("cr-ee", "computing", {"repo_count": 8, "geo_replication": True}),
    ("sls", "storage", {"retention_days": 90, "daily_ingestion_gb": 25}),
    ("rocketmq", "middleware", {"instance_type": "ecs.c6.large", "cpu": 2, "memory": 4, "mode": "cluster"}),
    ("clouddns", "networking", {"zones": 3, "records": 150}),
    ("dataworks", "analytics-computing", {"workspace": "analytics", "schedule": "daily"}),
    ("quickbi-public", "analytics-computing", {"dashboards": 3, "users": 20}),
    ("cms", "monitoring", {"alert_groups": 2, "check_interval_seconds": 60}),
    ("dds", "database", {"instance_type": "dds.mongo.mid", "storage_gb": 200, "replication": 3}),
]

RISK_TITLES = [
    "Latency degradation in target AZ",
    "Database replication lag exceeds RPO",
    "SSL certificate expiry during migration",
    "Third-party API compatibility gap",
    "Data residency compliance uncertainty",
    "Network bandwidth bottleneck",
    "Insufficient disk IOPS in target",
    "DNS propagation delay",
    "Firewall rule conflict",
    "Missing encryption at rest",
    "Credential rotation window overlap",
    "Load balancer health check failure",
    "Container image registry access",
    "Service mesh configuration drift",
    "Backup restore test overdue",
    "Change freeze period collision",
    "Jira epic missing approval",
    "Resource quota exceeded in target",
    "IAM policy incompatibility",
    "Monitoring agent version mismatch",
]

RISK_DESCRIPTIONS = [
    "Performance benchmarks indicate potential latency increase exceeding SLA thresholds.",
    "Replication lag observed during stress testing may breach RPO requirements.",
    "Certificate expiry dates overlap with planned migration window.",
    "Vendor API version in target differs from source; integration testing required.",
    "Legal review pending on data residency requirements for target region.",
    "Peak traffic estimates exceed provisioned bandwidth in target VPC.",
    "Storage performance testing shows IOPS shortfall under expected load.",
    "DNS TTL pre-lowering incomplete; cutover may experience extended propagation.",
    "Existing security group rules conflict with target network topology.",
    "Encryption configuration missing for object storage buckets.",
]

# ─── Helpers ─────────────────────────────────────────────────────────────────

def pick(items, k=1):
    if k == 1:
        return random.choice(items)
    return random.sample(items, k=min(k, len(items)))

def rand_date(start: datetime, end: datetime) -> str:
    delta = end - start
    return (start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))).strftime("%Y-%m-%d")

def compute_stage_progress(has_resources: bool, has_team: bool, survey_submitted: bool, approved: int, migration_completed: int, in_scope: int) -> dict:
    setup = 100 if (has_resources and has_team) else 0
    survey = 100 if survey_submitted else 0
    signoff = round(approved / 3 * 100)
    migration = round(migration_completed / in_scope * 100) if in_scope else 0
    overall = round(setup * 0.05 + survey * 0.15 + signoff * 0.10 + migration * 0.70)
    return {
        "setup": setup,
        "survey": survey,
        "signoff": signoff,
        "migration": migration,
        "overall": overall,
    }

def derive_status(stage: dict) -> str:
    if stage["setup"] == 0:
        return "planning"
    if stage["survey"] < 100:
        return "in-progress"
    if stage["signoff"] < 100:
        return "in-progress"
    if stage["migration"] == 0:
        return "signed-off"
    if stage["migration"] < 100:
        return "migrating"
    return "completed"

# ─── Project Generator ───────────────────────────────────────────────────────

STATUS_WEIGHTS = [
    ("planning", 25),
    ("in-progress", 30),
    ("signed-off", 15),
    ("migrating", 10),
    ("completed", 15),
    ("blocked", 5),
]

def generate_project(index: int) -> dict:
    app_name = pick(APP_NAMES)
    suffix = pick(APP_SUFFIXES)
    project_name = f"{app_name} {suffix}"
    project_id = f"M-{80001 + index:05d}"

    # Team & governance
    team_user_ids = pick(USER_IDS, k=random.randint(3, 5))
    business_owner = team_user_ids[0]
    technical_lead = team_user_ids[1] if len(team_user_ids) > 1 else team_user_ids[0]
    dba_owner = team_user_ids[2] if len(team_user_ids) > 2 else team_user_ids[0]

    # Status
    status = random.choices([s for s, _ in STATUS_WEIGHTS], weights=[w for _, w in STATUS_WEIGHTS])[0]

    # Resources
    resource_count = random.randint(10, 20)
    resources = []
    resource_products = random.choices(PRODUCTS, k=resource_count)
    for i, (product, category, base_specs) in enumerate(resource_products):
        specs = dict(base_specs)
        # Vary specs slightly
        if "cpu" in specs:
            specs["cpu"] = max(1, specs["cpu"] + random.randint(-2, 2))
        if "memory" in specs:
            specs["memory"] = max(1, specs["memory"] + random.randint(-4, 8))
        if "storage_gb" in specs:
            specs["storage_gb"] = max(10, specs["storage_gb"] + random.randint(-100, 500))
        if "capacity_gb" in specs:
            specs["capacity_gb"] = max(10, specs["capacity_gb"] + random.randint(-100, 500))
        if "daily_ingestion_gb" in specs:
            specs["daily_ingestion_gb"] = max(1, specs["daily_ingestion_gb"] + random.randint(-10, 30))

        sync_status = random.choices(
            ["synced", "out-of-sync", "provisioning"],
            weights=[30, 50, 20]
        )[0]

        resources.append({
            "resource_id": f"res-{project_id.lower()}-{i+1:03d}",
            "name": f"{app_name} {product.upper()} {i+1}",
            "product": product,
            "resource_set": f"corp-{project_id.lower()}-{app_name.lower()}-prod",
            "specs": specs,
            "target_resource_id": "tgt-placeholder",
            "sync_status": sync_status,
            "need_migration": random.random() < 0.85,
        })

    in_scope = [r for r in resources if r["need_migration"]]
    migration_completed = sum(1 for r in in_scope if r["sync_status"] == "synced")

    # ─── Enforce dependency chain: survey → signoff → migration ─────────────
    #
    # Rules:
    #   - setup == 0                              → planning
    #   - setup == 100 && survey < 100            → in-progress
    #   - setup == 100 && survey == 100 && signoff < 100  → in-progress
    #   - setup == 100 && survey == 100 && signoff == 100 && migration == 0      → signed-off
    #   - setup == 100 && survey == 100 && signoff == 100 && migration > 0 < 100 → migrating
    #   - setup == 100 && survey == 100 && signoff == 100 && migration == 100    → completed
    #
    # Therefore:
    #   - approved_count must be 0 when survey is NOT submitted.
    #   - migration_completed must be 0 when signoff is NOT complete.

    # 1. Choose a *target* status first, then back-fill the dependent booleans.
    target_status = status  # keep the weighted pick

    if target_status == "planning":
        survey_submitted = False
        approved_count   = 0
        migration_done   = 0

    elif target_status == "in-progress":
        # Two sub-stages inside "in-progress":
        #   (a) setup done, survey NOT done  → no approvals
        #   (b) setup done, survey done, signoff NOT done → some approvals possible
        sub_stage = random.choices(["before-survey", "before-signoff"], weights=[55, 45])[0]
        if sub_stage == "before-survey":
            survey_submitted = False
            approved_count   = 0
            migration_done   = 0
        else:
            survey_submitted = True
            approved_count   = random.choices([0, 1, 2], weights=[20, 50, 30])[0]
            migration_done   = 0

    elif target_status == "signed-off":
        survey_submitted = True
        approved_count   = 3
        migration_done   = 0

    elif target_status == "migrating":
        survey_submitted = True
        approved_count   = 3
        # some resources synced, but not all
        migration_done   = random.randint(1, max(1, len(in_scope) - 1)) if len(in_scope) > 1 else 0

    elif target_status == "completed":
        survey_submitted = True
        approved_count   = 3
        migration_done   = len(in_scope)

    elif target_status == "blocked":
        # blocked can happen at any stage, but still respect the dependency chain
        blocked_stage = random.choices(
            ["before-survey", "before-signoff", "before-migration", "during-migration"],
            weights=[15, 30, 30, 25]
        )[0]
        if blocked_stage == "before-survey":
            survey_submitted = False
            approved_count   = 0
            migration_done   = 0
        elif blocked_stage == "before-signoff":
            survey_submitted = True
            approved_count   = random.choices([0, 1, 2], weights=[20, 50, 30])[0]
            migration_done   = 0
        elif blocked_stage == "before-migration":
            survey_submitted = True
            approved_count   = 3
            migration_done   = 0
        else:  # during-migration
            survey_submitted = True
            approved_count   = 3
            migration_done   = random.randint(1, max(1, len(in_scope) - 1)) if len(in_scope) > 1 else 0

    else:
        survey_submitted = False
        approved_count   = 0
        migration_done   = 0

    # 2. Force the *actual* synced resource count to match migration_done
    #    (shuffle which resources are marked synced)
    for r in in_scope:
        r["sync_status"] = "out-of-sync"
    if migration_done > 0 and in_scope:
        synced_indices = random.sample(range(len(in_scope)), k=migration_done)
        for idx in synced_indices:
            in_scope[idx]["sync_status"] = "synced"
        migration_completed = migration_done
    else:
        migration_completed = 0

    # 3. Compute stage progress from the consistent state
    stage = compute_stage_progress(
        has_resources=True,
        has_team=True,
        survey_submitted=survey_submitted,
        approved=approved_count,
        migration_completed=migration_completed,
        in_scope=len(in_scope),
    )

    # 4. Derive status (should match target_status unless blocked, which overrides)
    derived = derive_status(stage)
    if target_status == "blocked":
        status = "blocked"
    else:
        status = derived

    # Approvals
    approval_roles = ["technical_lead", "business_owner", "platform_migration_lead"]
    approvals = []
    for i, role in enumerate(approval_roles):
        a_status = "approved" if i < approved_count else "pending"
        approver = None
        timestamp = None
        if a_status == "approved":
            approver_pool = [u for u in USERS if u["id"] in team_user_ids]
            approver = pick(approver_pool)["name"] if approver_pool else pick(USERS)["name"]
            timestamp = rand_date(datetime(2025, 1, 1), datetime(2026, 6, 1))
        approvals.append({
            "id": f"apv-{project_id}-{i+1}",
            "role": role,
            "approver": approver,
            "status": a_status,
            "timestamp": timestamp,
            "icon": "",
            "user_id": None,
        })

    # Risks
    risk_count = random.randint(2, 3)
    risks = []
    for i in range(risk_count):
        severity = random.choices(["critical", "medium", "low"], weights=[15, 50, 35])[0]
        risk_status = random.choices(["open", "in progress", "resolved"], weights=[40, 30, 30])[0]
        risks.append({
            "id": f"rsk-{project_id}-{i+1}",
            "title": pick(RISK_TITLES),
            "description": pick(RISK_DESCRIPTIONS),
            "severity": severity,
            "mitigation": "Mitigation plan documented and under review." if risk_status != "open" else None,
            "owner": pick([u["name"] for u in USERS if u["id"] in team_user_ids]),
            "risk_status": risk_status,
        })

    # Dates
    start = datetime(2025, 1, 1) + timedelta(days=random.randint(0, 365))
    end = start + timedelta(days=random.randint(60, 180))
    updated = rand_date(start, end)

    # Wave
    wave_id = pick(WAVE_IDS)

    project = {
        "id": project_id,
        "name": project_name,
        "status": status,
        "description": f"Migration of the {app_name} {suffix.lower()} to 3-AZ resilient cloud infrastructure.",
        "migration_wave": WAVE_NAMES[wave_id],
        "wave_id": wave_id,
        "itso": technical_lead,
        "governance_roles": {
            "technical_lead": technical_lead,
            "business_owner": business_owner,
            "dba_data_owner": dba_owner,
        },
        "application_overview": {
            "applicationName": project_name,
            "shortName": f"{app_name.upper()}-{suffix.upper().replace(' ', '-')[:8]}",
            "businessFunction": f"Enterprise {suffix.lower()} serving internal and external stakeholders.",
            "userBase": {
                "type": random.choice(["Internal", "External", "Both"]),
                "count": f"~{random.randint(50, 5000)} users",
            },
            "applicationTier": random.choice(APP_TIERS),
            "baId": f"EIM-{random.randint(1000, 99999):05d}",
            "systemImportanceClassification": random.choices(["IBS", "BPS"], k=random.randint(0, 2)),
            "iitaApplicability": random.random() < 0.3,
            "softwareOrigin": random.choice(["in-house", "3rd party"]),
            "migrationStrategy": random.choice(MIGRATION_STRATEGIES),
            "serviceLine": random.choice(SERVICE_LINES),
        },
        "availability": {
            "rto": random.choice(["15 minutes", "1 hour", "2 hours", "4 hours", "8 hours"]),
            "rpo": random.choice(["0", "15 minutes", "30 minutes", "1 hour", "4 hours"]),
            "azReadiness3Az": random.choice([
                "Fully 3AZ-ready with active-active configuration.",
                "Stateless layer ready; database requires replication changes.",
                "Quorum configured for 2 nodes only; third AZ needs re-architecture.",
                "Load balancer not yet configured for cross-AZ failover.",
            ]),
            "healthCheckEndpoints": ["/health", "/api/status", "/ready"] if random.random() < 0.5 else ["/health"],
        },
        "data_persistence": {
            "databaseTypes": random.sample(["PostgreSQL", "MySQL", "Oracle", "Redis", "MongoDB", "SQL Server"], k=random.randint(1, 3)),
            "totalDataVolume": f"~{random.randint(10, 5000)} GB",
            "dataGrowthRate": f"+{random.randint(1, 100)} GB / month",
            "backupRequiredDuringMigration": random.random() < 0.7,
            "lastRestoreTest": f"https://brett.corp.com/tests/{app_name.lower()}-restore-{rand_date(datetime(2024, 1, 1), datetime(2026, 3, 1))}",
            "dataResidency": random.choice(["EU-West", "US-East", "APAC-Singapore", "All regions"]),
            "encryptionAtRest": random.choice(["AES-256", "LUKS", "AWS KMS", "Azure Key Vault", "None"]),
            "statefulComponents": random.sample(["Primary DB", "Read Replica", "Cache Layer", "Message Queue", "File Store"], k=random.randint(1, 3)),
        },
        "dependencies": {
            "upstream": [
                {
                    "id": f"dep-{project_id}-up-{i+1}",
                    "name": random.choice(["Auth Service", "Payment Gateway", "LDAP", "DNS", "Monitoring", "Config Store"]),
                    "baId": f"EIM-{random.randint(1000, 99999):05d}",
                    "contactEmail": "team@corp.com",
                    "hosting": random.choice(["On-Premise", "AliCloud", "AWS"]),
                    "notes": "",
                }
                for i in range(random.randint(2, 4))
            ],
            "downstream": [
                {
                    "id": f"dep-{project_id}-dn-{i+1}",
                    "name": random.choice(["BI Platform", "Invoicing", "Audit Log", "CDN", "API Gateway"]),
                    "baId": f"EIM-{random.randint(1000, 99999):05d}",
                    "contactEmail": "team@corp.com",
                    "hosting": random.choice(["On-Premise", "AliCloud", "AWS"]),
                    "notes": "",
                }
                for i in range(random.randint(2, 4))
            ],
        },
        "nfrs": {
            "peakLoad": f"~{random.randint(100, 50000)} req/s peak",
            "autoscaling": random.choice(["HPA via K8s", "ECS service scaling", "Manual scaling", "Not configured"]),
            "licensing": random.choice(["OSS — no concerns", "Per-socket licensing", "SaaS subscription", "Enterprise agreement"]),
        },
        "migration_constraints": {
            "regularMigrationWindow": random.choice(["Saturday 02:00–06:00", "Sunday 00:00–04:00", "Weeknights 22:00–02:00"]),
            "preferredMigrationWindow": random.sample(["weekday", "weekend"], k=random.randint(1, 2)),
            "earliestStartDate": start.strftime("%Y-%m-%d"),
            "latestEndDate": end.strftime("%Y-%m-%d"),
            "crDurationHours": random.randint(2, 12),
            "snowCiGroups": random.sample(["infra", "dba", "network", "security", "app-team"], k=random.randint(1, 3)),
            "changeFreezePeriods": [
                {
                    "name": random.choice(["Year-end freeze", "Q4 lockdown", "Audit prep"]),
                    "from": rand_date(datetime(2025, 1, 1), datetime(2025, 10, 1)),
                    "to": rand_date(datetime(2025, 11, 1), datetime(2026, 3, 1)),
                }
                for _ in range(random.randint(0, 2))
            ],
        },
        "target_architecture": {
            "reArchitectureNeeded": random.random() < 0.4,
            "topology3Az": "Active-active across AZ-1 and AZ-2 with standby in AZ-3.",
            "dnsIpChanges": "DNS updated to new load balancer endpoints.",
            "newServicesRequired": random.sample(
                ["Azure App Gateway", "Azure Key Vault", "Azure Monitor", "Azure DNS", "Azure Firewall"],
                k=random.randint(1, 3)
            ),
        },
        "risks": risks,
        "resources": resources,
        "project_users": team_user_ids,
        "planning": {
            "startDate": start.strftime("%Y-%m-%d"),
            "endDate": end.strftime("%Y-%m-%d"),
            "planStartDate": start.strftime("%Y-%m-%d"),
            "planEndDate": end.strftime("%Y-%m-%d"),
            "tasks": [],
        },
        "approvals": approvals,
        "jira_story_key": f"MIG-{80001 + index:05d}",
        "survey_submitted_at": (start + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S.000Z") if survey_submitted else None,
        "updated_at": updated,
    }

    return project


# IDs of the original hand-written seed projects that must always be preserved
ORIGINAL_IDS = {"PRJ-2024-ALPHA", "M-11029", "M-88271", "M-77122"}


def main():
    # Load existing projects, but filter back to originals only
    # (in case the script was run before and appended generated ones)
    with open(DATA_DIR / "projects.json") as f:
        existing = json.load(f)

    originals = [p for p in existing if p["id"] in ORIGINAL_IDS]

    generated = [generate_project(i) for i in range(200)]

    combined = originals + generated

    with open(DATA_DIR / "projects.json", "w") as f:
        json.dump(combined, f, indent=2)

    print(f"Generated {len(generated)} projects. Total in file: {len(combined)}")


if __name__ == "__main__":
    main()
