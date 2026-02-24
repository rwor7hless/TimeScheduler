"""add telegram integration tables and columns

Revision ID: 005_telegram
Revises: 004_boards
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "005_telegram"
down_revision: Union[str, None] = "004_boards"
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

    # Add telegram fields to users
    if not column_exists(conn, "users", "telegram_chat_id"):
        op.add_column("users", sa.Column("telegram_chat_id", sa.String(50), nullable=True))
    if not column_exists(conn, "users", "telegram_key"):
        op.add_column("users", sa.Column("telegram_key", sa.String(64), nullable=True))
        op.create_unique_constraint("uq_users_telegram_key", "users", ["telegram_key"])

    # Add tg reminder fields to tasks
    if not column_exists(conn, "tasks", "tg_remind"):
        op.add_column("tasks", sa.Column("tg_remind", sa.Boolean(), nullable=False, server_default="false"))
    if not column_exists(conn, "tasks", "tg_remind_at"):
        op.add_column("tasks", sa.Column("tg_remind_at", sa.DateTime(timezone=True), nullable=True))
    if not column_exists(conn, "tasks", "tg_reminded"):
        op.add_column("tasks", sa.Column("tg_reminded", sa.Boolean(), nullable=False, server_default="false"))

    # Create telegram_keys table (temporary keys issued by bot)
    if not table_exists(conn, "telegram_keys"):
        op.create_table(
            "telegram_keys",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("key", sa.String(64), nullable=False, unique=True),
            sa.Column("chat_id", sa.String(50), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_telegram_keys_key", "telegram_keys", ["key"])


def downgrade() -> None:
    conn = op.get_bind()

    if table_exists(conn, "telegram_keys"):
        op.drop_index("ix_telegram_keys_key", table_name="telegram_keys")
        op.drop_table("telegram_keys")

    if column_exists(conn, "tasks", "tg_reminded"):
        op.drop_column("tasks", "tg_reminded")
    if column_exists(conn, "tasks", "tg_remind_at"):
        op.drop_column("tasks", "tg_remind_at")
    if column_exists(conn, "tasks", "tg_remind"):
        op.drop_column("tasks", "tg_remind")

    if column_exists(conn, "users", "telegram_key"):
        op.drop_constraint("uq_users_telegram_key", "users", type_="unique")
        op.drop_column("users", "telegram_key")
    if column_exists(conn, "users", "telegram_chat_id"):
        op.drop_column("users", "telegram_chat_id")
