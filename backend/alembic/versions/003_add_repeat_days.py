"""add repeat_days for recurring tasks

Revision ID: 003_repeat_days
Revises: 002_add_users
Create Date: 2025-02-23

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa

revision: str = "003_repeat_days"
down_revision: Union[str, None] = "002_add_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    conn = op.get_bind()
    if not column_exists(conn, "tasks", "repeat_days"):
        op.add_column(
            "tasks",
            sa.Column("repeat_days", sa.ARRAY(sa.Integer()), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if column_exists(conn, "tasks", "repeat_days"):
        op.drop_column("tasks", "repeat_days")
