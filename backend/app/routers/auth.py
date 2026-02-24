from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import Token, UserInfo
from app.services.auth import create_access_token, verify_password_hash
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/token", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password_hash(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(user.username, user.id)
    return Token(access_token=access_token)


@router.get("/me", response_model=UserInfo)
async def me(user: User = Depends(get_current_user)):
    return UserInfo(username=user.username, user_id=user.id, is_admin=user.is_admin)
