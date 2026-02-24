"""add boards table and board_id on tasks

Revision ID: 004_boards
Revises: 003_repeat_days
Create Date: 2026-02-23

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, inspect
import sqlalchemy as sa


revision: str = "004_boards"
down_revision: Union[str, None] = "003_repeat_days"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(conn, table: str) -> bool:
    insp = inspect(conn)
    return table in insp.get_table_names()


def column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    conn = op.get_bind()

    if not table_exists(conn, "boards"):
        op.create_table(
            "boards",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )

    if not column_exists(conn, "tasks", "board_id"):
        op.add_column(
            "tasks",
            sa.Column("board_id", sa.Integer(), sa.ForeignKey("boards.id", ondelete="SET NULL"), nullable=True),
        )
        op.create_index("ix_tasks_board_id", "tasks", ["board_id"])


def downgrade() -> None:
    conn = op.get_bind()
    if column_exists(conn, "tasks", "board_id"):
        op.drop_index("ix_tasks_board_id", table_name="tasks")
        op.drop_column("tasks", "board_id")

    if table_exists(conn, "boards"):
        op.drop_table("boards")

