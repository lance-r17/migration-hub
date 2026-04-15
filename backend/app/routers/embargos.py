from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.embargo import EmbargoCreate, EmbargoOut, EmbargoUpdate
from app.services import embargo_service

router = APIRouter(prefix="/embargos", tags=["embargos"])


@router.get("", response_model=list[EmbargoOut])
async def list_embargos(db: AsyncSession = Depends(get_db)):
    embargos = await embargo_service.get_all(db)
    return [EmbargoOut.from_orm_entry(e) for e in embargos]


@router.post("", response_model=EmbargoOut, status_code=201)
async def create_embargo(body: EmbargoCreate, db: AsyncSession = Depends(get_db)):
    embargo = await embargo_service.create(db, body)
    return EmbargoOut.from_orm_entry(embargo)


@router.put("/{embargo_id}", response_model=EmbargoOut)
async def update_embargo(
    embargo_id: str, body: EmbargoUpdate, db: AsyncSession = Depends(get_db)
):
    embargo = await embargo_service.get_by_id(db, embargo_id)
    if not embargo:
        raise HTTPException(status_code=404, detail="Embargo not found")
    embargo = await embargo_service.update(db, embargo, body)
    return EmbargoOut.from_orm_entry(embargo)


@router.delete("/{embargo_id}", status_code=204)
async def delete_embargo(embargo_id: str, db: AsyncSession = Depends(get_db)):
    embargo = await embargo_service.get_by_id(db, embargo_id)
    if not embargo:
        raise HTTPException(status_code=404, detail="Embargo not found")
    await embargo_service.delete(db, embargo)
