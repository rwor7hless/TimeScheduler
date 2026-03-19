"""add composite index and deleted_at for soft delete

Revision ID: 011
Revises: 010_add_subtasks
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa

revision = '011_composite_idx_deleted_at'
down_revision = '010_add_subtasks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy import inspect

    # Composite index for task list queries
    indexes = [i['name'] for i in inspect(conn).get_indexes('tasks')]
    if 'ix_tasks_user_board_status' not in indexes:
        op.create_index(
            'ix_tasks_user_board_status',
            'tasks',
            ['user_id', 'board_id', 'status'],
        )

    # deleted_at column for soft delete / audit
    cols = [c['name'] for c in inspect(conn).get_columns('tasks')]
    if 'deleted_at' not in cols:
        op.add_column(
            'tasks',
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index('ix_tasks_deleted_at', 'tasks', ['deleted_at'])


def downgrade() -> None:
    op.drop_index('ix_tasks_deleted_at', table_name='tasks')
    op.drop_column('tasks', 'deleted_at')
    op.drop_index('ix_tasks_user_board_status', table_name='tasks')
