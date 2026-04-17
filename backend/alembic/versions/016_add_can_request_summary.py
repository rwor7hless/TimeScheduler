"""add can_request_summary flag to users

Revision ID: 016_add_can_request_summary
Revises: 015_add_telegram_state
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa

revision = '016_add_can_request_summary'
down_revision = '015_add_telegram_state'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'can_request_summary',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
        ),
    )
    op.execute("UPDATE users SET can_request_summary = true WHERE is_admin = true")


def downgrade() -> None:
    op.drop_column('users', 'can_request_summary')
