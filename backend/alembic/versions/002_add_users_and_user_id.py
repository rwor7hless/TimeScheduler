"""add users and user_id to tasks habits tags

Revision ID: 002_add_users
Revises: 001_add_task_color
Create Date: 2025-02-23

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect, text
import sqlalchemy as sa

revision: str = "002_add_users"
down_revision: Union[str, None] = "001_add_task_color"
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

    if not table_exists(conn, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("username", sa.String(50), unique=True, nullable=False),
            sa.Column("password_hash", sa.String(255), nullable=False),
            sa.Column("is_admin", sa.Boolean(), server_default="false"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    for table in ("tasks", "habits", "tags"):
        if not column_exists(conn, table, "user_id"):
            op.add_column(table, sa.Column("user_id", sa.Integer(), nullable=True))
            op.create_foreign_key(
                f"fk_{table}_user_id", table, "users", ["user_id"], ["id"], ondelete="CASCADE"
            )
            op.create_index(f"ix_{table}_user_id", table, ["user_id"])

    # Ensure admin user exists and assign orphaned data
    from app.config import settings
    from pwdlib import PasswordHash

    ph = PasswordHash.recommended()
    hashed = ph.hash(settings.user_password)

    result = conn.execute(text("SELECT id FROM users WHERE username = :u"), {"u": settings.user_login})
    row = result.fetchone()
    if not row:
        conn.execute(
            text("INSERT INTO users (username, password_hash, is_admin) VALUES (:u, :p, true)"),
            {"u": settings.user_login, "p": hashed},
        )
        result = conn.execute(text("SELECT id FROM users WHERE username = :u"), {"u": settings.user_login})
        admin_id = result.fetchone()[0]

        for t in ("tasks", "habits", "tags"):
            conn.execute(text(f"UPDATE {t} SET user_id = :aid WHERE user_id IS NULL"), {"aid": admin_id})

        for t in ("tasks", "habits", "tags"):
            try:
                op.alter_column(
                    t, "user_id",
                    existing_type=sa.Integer(),
                    nullable=False,
                )
            except Exception:
                pass  # may already be non-null from create_all

    # Tags: replace unique(name) with unique(user_id, name)
    for c in inspect(conn).get_unique_constraints("tags"):
        if "name" in c["column_names"] and "user_id" not in c["column_names"]:
            op.drop_constraint(c["name"], "tags", type_="unique")
            break
    try:
        op.create_unique_constraint("uq_tag_user_name", "tags", ["user_id", "name"])
    except Exception:
        pass  # may already exist from create_all


def downgrade() -> None:
    conn = op.get_bind()
    try:
        op.drop_constraint("uq_tag_user_name", "tags", type_="unique")
    except Exception:
        pass
    for table in ("tasks", "habits", "tags"):
        if column_exists(conn, table, "user_id"):
            op.drop_constraint(f"fk_{table}_user_id", table, type_="foreignkey")
            op.drop_index(f"ix_{table}_user_id", table)
            op.drop_column(table, "user_id")
    if table_exists(conn, "users"):
        op.drop_table("users")
