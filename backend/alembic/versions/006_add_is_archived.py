"""add is_archived to tasks

Revision ID: 006_archived
Revises: 005_telegram
Create Date: 2026-02-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "006_archived"
down_revision: Union[str, None] = "005_telegram"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    conn = op.get_bind()
    if not column_exists(conn, "tasks", "is_archived"):
        op.add_column(
            "tasks",
            sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if column_exists(conn, "tasks", "is_archived"):
        op.drop_column("tasks", "is_archived")
