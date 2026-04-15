from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.wave import WaveCreate, WaveImportRequest, WaveOut, WavePatch
from app.services import wave_service

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
        source=wave.source,
        status=wave.status,
        created_at=wave.created_at.isoformat() if wave.created_at else None,
    )


@router.get("", response_model=list[WaveOut])
async def list_waves(db: AsyncSession = Depends(get_db)):
    waves = await wave_service.get_all(db)
    return [_wave_out(w) for w in waves]


@router.post("", response_model=WaveOut, status_code=201)
async def create_wave(body: WaveCreate, db: AsyncSession = Depends(get_db)):
    wave = await wave_service.create(db, body)
    return _wave_out(wave)


@router.post("/import", response_model=WaveOut, status_code=201)
async def import_wave(body: WaveImportRequest, db: AsyncSession = Depends(get_db)):
    wave = await wave_service.import_from_jira(db, body.epic_key)
    return _wave_out(wave)


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
