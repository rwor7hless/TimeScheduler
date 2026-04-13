"""add weekly_reports table

Revision ID: 014
Revises: 013_add_my_day
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = '014_add_weekly_reports'
down_revision = '013_add_my_day'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if not conn.dialect.has_table(conn, 'weekly_reports'):
        op.create_table(
            'weekly_reports',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('week_start', sa.Date(), nullable=False),
            sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
            sa.Column('content', sa.Text(), nullable=True),
            sa.Column('error_msg', sa.String(500), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'week_start', name='uq_report_user_week'),
        )
        op.create_index('ix_weekly_reports_user_id', 'weekly_reports', ['user_id'])


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.has_table(conn, 'weekly_reports'):
        op.drop_index('ix_weekly_reports_user_id', table_name='weekly_reports')
        op.drop_table('weekly_reports')
