from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.custom_nav_card import CustomNavCardOut, CustomNavCardUpdate
from app.services import custom_nav_card_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/nav-card", response_model=CustomNavCardOut)
async def get_custom_nav_card(db: AsyncSession = Depends(get_db)):
    return await custom_nav_card_service.get_custom_nav_card(db)


@router.put("/nav-card", response_model=CustomNavCardOut)
async def update_custom_nav_card(
    body: CustomNavCardUpdate, db: AsyncSession = Depends(get_db)
):
    return await custom_nav_card_service.update_custom_nav_card(db, body)
