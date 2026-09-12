from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.user_local_account import UserLocalAccount
from app.schemas.local_account import LocalAccountOwnerOut
from app.schemas.user import LoginRequest, UserOut
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db)):
    return await user_service.get_all(db)


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project_roles = await user_service.get_project_roles(db, current_user.id)
    return UserOut.model_validate(current_user).model_copy(
        update={"project_roles": sorted(project_roles)}
    )


@router.get("/me/local-account", response_model=LocalAccountOwnerOut)
async def get_my_local_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's local account, including the password.
    This is the only endpoint that exposes the password, and only to the owner."""
    account = await db.get(UserLocalAccount, current_user.id)
    if not account:
        raise HTTPException(status_code=404, detail="Local account not found")
    return account


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await user_service.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/login", response_model=UserOut)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await user_service.get_by_email(db, body.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user
