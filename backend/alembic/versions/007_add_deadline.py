"""add deadline to tasks

Revision ID: 007_deadline
Revises: 006_archived
Create Date: 2026-02-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "007_deadline"
down_revision: Union[str, None] = "006_archived"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    conn = op.get_bind()
    if not column_exists(conn, "tasks", "deadline"):
        op.add_column(
            "tasks",
            sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if column_exists(conn, "tasks", "deadline"):
        op.drop_column("tasks", "deadline")
