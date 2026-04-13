"""add my_day to tasks

Revision ID: 013
Revises: 012_drop_notes_table
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = '013_add_my_day'
down_revision = '012_drop_notes_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('my_day', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('tasks', 'my_day')
