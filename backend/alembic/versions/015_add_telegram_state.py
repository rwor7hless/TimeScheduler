"""add telegram_state table

Revision ID: 015_add_telegram_state
Revises: 014_add_weekly_reports
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa

revision = '015_add_telegram_state'
down_revision = '014_add_weekly_reports'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if not conn.dialect.has_table(conn, 'telegram_state'):
        op.create_table(
            'telegram_state',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('last_update_id', sa.BigInteger(), nullable=False, server_default='0'),
        )
        op.execute("INSERT INTO telegram_state (id, last_update_id) VALUES (1, 0)")


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.has_table(conn, 'telegram_state'):
        op.drop_table('telegram_state')
