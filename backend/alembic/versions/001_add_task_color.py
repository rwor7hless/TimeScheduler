"""add task color

Revision ID: 001_add_task_color
Revises: None
Create Date: 2025-02-23

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa

revision: str = "001_add_task_color"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    conn = op.get_bind()
    if not column_exists(conn, "tasks", "color"):
        op.add_column("tasks", sa.Column("color", sa.String(7), server_default="#6B7280"))


def downgrade() -> None:
    conn = op.get_bind()
    if column_exists(conn, "tasks", "color"):
        op.drop_column("tasks", "color")
