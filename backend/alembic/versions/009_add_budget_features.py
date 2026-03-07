"""add budget tags, allocations, transaction_tags

Revision ID: 009
Revises: 008
Create Date: 2026-03-07
"""
from alembic import op
import sqlalchemy as sa

revision = '009_budget_features'
down_revision = '008_notes_budget'
branch_labels = None
depends_on = None


def _table_exists(conn, table: str) -> bool:
    from sqlalchemy import inspect
    return inspect(conn).has_table(table)


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, 'budget_tags'):
        op.create_table(
            'budget_tags',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('name', sa.String(50), nullable=False),
            sa.Column('color', sa.String(7), nullable=False, server_default='#6B7280'),
        )

    if not _table_exists(conn, 'transaction_tags'):
        op.create_table(
            'transaction_tags',
            sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('tag_id', sa.Integer(), sa.ForeignKey('budget_tags.id', ondelete='CASCADE'), primary_key=True),
        )

    if not _table_exists(conn, 'budget_allocations'):
        op.create_table(
            'budget_allocations',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('year', sa.Integer(), nullable=False),
            sa.Column('month', sa.Integer(), nullable=False),
            sa.Column('category', sa.String(50), nullable=False),
            sa.Column('limit_amount', sa.Float(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.UniqueConstraint('user_id', 'year', 'month', 'category', name='uq_allocation_user_period_cat'),
        )


def downgrade() -> None:
    op.drop_table('budget_allocations')
    op.drop_table('transaction_tags')
    op.drop_table('budget_tags')
