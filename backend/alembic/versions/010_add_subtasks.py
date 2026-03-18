"""add parent_id to tasks for subtasks

Revision ID: 010
Revises: 009_budget_features
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa

revision = '010_add_subtasks'
down_revision = '009_budget_features'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy import inspect, text
    cols = [c['name'] for c in inspect(conn).get_columns('tasks')]
    if 'parent_id' not in cols:
        op.add_column('tasks', sa.Column('parent_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_tasks_parent_id',
            'tasks', 'tasks',
            ['parent_id'], ['id'],
            ondelete='CASCADE',
        )
        op.create_index('ix_tasks_parent_id', 'tasks', ['parent_id'])


def downgrade() -> None:
    op.drop_index('ix_tasks_parent_id', table_name='tasks')
    op.drop_constraint('fk_tasks_parent_id', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'parent_id')
