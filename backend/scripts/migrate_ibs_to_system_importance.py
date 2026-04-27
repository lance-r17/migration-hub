"""
One-time migration script:
  - Converts project.application_overview.ibsInScope (bool)
    → project.application_overview.systemImportanceClassification (list)
  - Removes the legacy ibsInScope key.

Run with:
  cd backend && python -m scripts.migrate_ibs_to_system_importance
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path so we can import app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, update
from app.database import AsyncSessionLocal
from app.models.project import Project


async def migrate() -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Project))
        projects = result.scalars().all()

        updated = 0
        for project in projects:
            ao = project.application_overview or {}
            if "ibsInScope" not in ao:
                continue

            ibs_value = ao.pop("ibsInScope")
            if ibs_value is True:
                ao["systemImportanceClassification"] = ["IBS"]
            else:
                # If false or null, leave the new field absent / empty
                ao.setdefault("systemImportanceClassification", [])

            project.application_overview = ao
            updated += 1

        await session.commit()
        print(f"Migration complete. Updated {updated} project(s).")


if __name__ == "__main__":
    asyncio.run(migrate())
