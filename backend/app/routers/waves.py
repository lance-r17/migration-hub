import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from pydantic import BaseModel

from app.schemas.wave import WaveCreate, WaveImportRequest, WaveOut, WavePatch
from app.services import jira_client, wave_service

router = APIRouter(prefix="/waves", tags=["waves"])


def _wave_out(wave) -> WaveOut:
    return WaveOut(
        id=wave.id,
        name=wave.name,
        start_date=wave.start_date,
        cutover_date=wave.cutover_date,
        description=wave.description,
        jira_project_key=wave.jira_project_key,
        jira_epic_key=wave.jira_epic_key,
        jira_base_url=settings.jira_base_url,
        source=wave.source,
        status=wave.status,
        color=wave.color,
        project_order=wave.project_order,
        created_at=wave.created_at.isoformat() if wave.created_at else None,
    )


@router.get("", response_model=list[WaveOut])
async def list_waves(db: AsyncSession = Depends(get_db)):
    waves = await wave_service.get_all(db)
    return [_wave_out(w) for w in waves]


@router.post("", response_model=WaveOut, status_code=201)
async def create_wave(body: WaveCreate, db: AsyncSession = Depends(get_db)):
    if body.jira_project_key is None:
        body.jira_project_key = settings.jira_project_key
    try:
        body.jira_epic_key = await jira_client.create_epic(
            project_key=body.jira_project_key,
            summary=body.name,
            description=body.description,
            start_date=body.start_date,
            cutover_date=body.cutover_date,
        )
    except ValueError:
        raise HTTPException(status_code=503, detail="Jira is not configured")
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="Failed to create Jira epic")
    wave = await wave_service.create(db, body)
    return _wave_out(wave)


@router.post("/import", response_model=WaveOut, status_code=201)
async def import_wave(body: WaveImportRequest, db: AsyncSession = Depends(get_db)):
    try:
        wave = await wave_service.import_from_jira(db, body.epic_key, body.color)
        return _wave_out(wave)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{wave_id}", response_model=WaveOut)
async def get_wave(wave_id: str, db: AsyncSession = Depends(get_db)):
    wave = await wave_service.get_by_id(db, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")
    return _wave_out(wave)


@router.patch("/{wave_id}", response_model=WaveOut)
async def update_wave(wave_id: str, body: WavePatch, db: AsyncSession = Depends(get_db)):
    wave = await wave_service.get_by_id(db, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")
    wave = await wave_service.update(db, wave, body)
    return _wave_out(wave)


class ProjectOrderBody(BaseModel):
    project_order: list[str]


@router.patch("/{wave_id}/project-order", response_model=WaveOut)
async def update_project_order(wave_id: str, body: ProjectOrderBody, db: AsyncSession = Depends(get_db)):
    wave = await wave_service.get_by_id(db, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")
    wave.project_order = body.project_order
    await db.commit()
    return _wave_out(wave)


@router.post("/{wave_id}/sync", response_model=WaveOut)
async def sync_wave(wave_id: str, db: AsyncSession = Depends(get_db)):
    try:
        wave = await wave_service.sync_from_jira(db, wave_id)
        return _wave_out(wave)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="Failed to fetch Jira epic")
