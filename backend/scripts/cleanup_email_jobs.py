#!/usr/bin/env python3
"""Clean up (delete) all email jobs from the database."""
import asyncio
import sys

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

sys.path.insert(0, "/workspaces/migration-hub/backend")
from app.config import settings  # noqa: E402


async def main():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT COUNT(*) FROM email_jobs"))
        total = result.scalar()
        print(f"Deleting {total} email job(s)...")
        await conn.execute(text("DELETE FROM email_jobs"))
    await engine.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
