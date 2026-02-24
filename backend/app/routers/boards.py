from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.board import Board
from app.models.user import User
from app.schemas.board import BoardCreate, BoardResponse, BoardUpdate


router = APIRouter(prefix="/api/boards", tags=["boards"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[BoardResponse])
async def list_boards(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Board).where(Board.user_id == current_user.id).order_by(Board.id)
    )
    return result.scalars().all()


@router.post("", response_model=BoardResponse, status_code=status.HTTP_201_CREATED)
async def create_board(
    data: BoardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = Board(user_id=current_user.id, name=data.name)
    db.add(board)
    await db.commit()
    await db.refresh(board)
    return board


@router.patch("/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: int,
    data: BoardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Board).where(Board.id == board_id, Board.user_id == current_user.id)
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(board, field, value)

    await db.commit()
    await db.refresh(board)
    return board


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(
    board_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Board).where(Board.id == board_id, Board.user_id == current_user.id)
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    await db.delete(board)
    await db.commit()

