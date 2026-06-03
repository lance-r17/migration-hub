from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.category_milestone import (
    CategoryMilestoneBatchAssign,
    CategoryMilestoneCreate,
    CategoryMilestoneOut,
    CategoryMilestoneUpdate,
)
from app.services import category_milestone_service

router = APIRouter(prefix="/category-milestones", tags=["category-milestones"])


@router.get("", response_model=list[CategoryMilestoneOut])
async def list_category_milestones(db: AsyncSession = Depends(get_db)):
    cms = await category_milestone_service.get_all(db)
    return [CategoryMilestoneOut.from_orm_entry(c) for c in cms]


@router.post("", response_model=CategoryMilestoneOut, status_code=201)
async def create_category_milestone(
    body: CategoryMilestoneCreate, db: AsyncSession = Depends(get_db)
):
    cm = await category_milestone_service.create(db, body)
    return CategoryMilestoneOut.from_orm_entry(cm)


@router.patch("/{cm_id}", response_model=CategoryMilestoneOut)
async def update_category_milestone(
    cm_id: str, body: CategoryMilestoneUpdate, db: AsyncSession = Depends(get_db)
):
    cm = await category_milestone_service.get_by_id(db, cm_id)
    if not cm:
        raise HTTPException(status_code=404, detail="Category milestone not found")
    cm = await category_milestone_service.update(db, cm, body)
    return CategoryMilestoneOut.from_orm_entry(cm)


@router.delete("/{cm_id}", status_code=204)
async def delete_category_milestone(cm_id: str, db: AsyncSession = Depends(get_db)):
    cm = await category_milestone_service.get_by_id(db, cm_id)
    if not cm:
        raise HTTPException(status_code=404, detail="Category milestone not found")
    await category_milestone_service.delete(db, cm)


@router.post("/batch-assign", status_code=204)
async def batch_assign_category_milestone(
    body: CategoryMilestoneBatchAssign, db: AsyncSession = Depends(get_db)
):
    try:
        await category_milestone_service.batch_assign(
            db, body.category_milestone_id, body.project_ids, body.unassign
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
