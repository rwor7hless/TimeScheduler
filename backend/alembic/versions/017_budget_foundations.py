"""add budget_categories, recurring_transactions, planned_tags, budget_alert_log + source FKs

Revision ID: 017_budget_foundations
Revises: 016_add_can_request_summary
Create Date: 2026-04-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '017_budget_foundations'
down_revision = '016_add_can_request_summary'
branch_labels = None
depends_on = None


def _table_exists(conn, table: str) -> bool:
    from sqlalchemy import inspect
    return inspect(conn).has_table(table)


def _column_exists(conn, table: str, column: str) -> bool:
    from sqlalchemy import inspect
    return column in [c['name'] for c in inspect(conn).get_columns(table)]


DEFAULT_CATEGORIES = [
    ('food',          'Еда',           '🍔', '#F59E0B', 0),
    ('transport',     'Транспорт',     '🚗', '#3B82F6', 1),
    ('housing',       'Жильё',         '🏠', '#8B5CF6', 2),
    ('health',        'Здоровье',      '💊', '#10B981', 3),
    ('entertainment', 'Развлечения',   '🎮', '#F97316', 4),
    ('clothing',      'Одежда',        '👗', '#EC4899', 5),
    ('tech',          'Техника',       '💻', '#06B6D4', 6),
    ('education',     'Образование',   '📚', '#84CC16', 7),
    ('travel',        'Путешествия',   '✈️', '#EF4444', 8),
    ('subscriptions', 'Подписки',      '🔄', '#6366F1', 9),
    ('other',         'Прочее',        '📦', '#9CA3AF', 10),
]


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, 'budget_categories'):
        op.create_table(
            'budget_categories',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('key', sa.String(50), nullable=False),
            sa.Column('label', sa.String(50), nullable=False),
            sa.Column('icon', sa.String(16), nullable=False, server_default='📦'),
            sa.Column('color', sa.String(7), nullable=False, server_default='#9CA3AF'),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.UniqueConstraint('user_id', 'key', name='uq_budget_category_user_key'),
        )

        # Seed defaults for every existing user
        users = conn.execute(sa.text("SELECT id FROM users")).fetchall()
        for (user_id,) in users:
            for key, label, icon, color, sort_order in DEFAULT_CATEGORIES:
                conn.execute(
                    sa.text(
                        "INSERT INTO budget_categories (user_id, key, label, icon, color, sort_order) "
                        "VALUES (:user_id, :key, :label, :icon, :color, :sort_order)"
                    ),
                    {
                        "user_id": user_id,
                        "key": key,
                        "label": label,
                        "icon": icon,
                        "color": color,
                        "sort_order": sort_order,
                    },
                )

    if not _table_exists(conn, 'recurring_transactions'):
        op.create_table(
            'recurring_transactions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('type', sa.String(10), nullable=False),
            sa.Column('amount', sa.Float(), nullable=False),
            sa.Column('category', sa.String(50), nullable=True),
            sa.Column('description', sa.String(500), nullable=False, server_default=''),
            sa.Column('tag_ids', postgresql.ARRAY(sa.Integer()), nullable=False, server_default=sa.text("'{}'::integer[]")),
            sa.Column('day_of_month', sa.Integer(), nullable=False),
            sa.Column('start_date', sa.String(10), nullable=False),  # yyyy-MM-dd
            sa.Column('end_date', sa.String(10), nullable=True),
            sa.Column('last_generated_date', sa.String(10), nullable=True),
            sa.Column('is_paused', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )

    if not _table_exists(conn, 'planned_tags'):
        op.create_table(
            'planned_tags',
            sa.Column('planned_purchase_id', sa.Integer(), sa.ForeignKey('planned_purchases.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('tag_id', sa.Integer(), sa.ForeignKey('budget_tags.id', ondelete='CASCADE'), primary_key=True),
        )

    if not _table_exists(conn, 'budget_alert_log'):
        op.create_table(
            'budget_alert_log',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('year', sa.Integer(), nullable=False),
            sa.Column('month', sa.Integer(), nullable=False),
            sa.Column('category', sa.String(50), nullable=False),
            sa.Column('threshold', sa.Integer(), nullable=False),  # 80, 100, 120
            sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.UniqueConstraint('user_id', 'year', 'month', 'category', 'threshold', name='uq_alert_once'),
        )

    if not _column_exists(conn, 'transactions', 'source_planned_id'):
        op.add_column(
            'transactions',
            sa.Column('source_planned_id', sa.Integer(), nullable=True),
        )

    if not _column_exists(conn, 'planned_purchases', 'source_recurring_id'):
        op.add_column(
            'planned_purchases',
            sa.Column('source_recurring_id', sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, 'planned_purchases', 'source_recurring_id'):
        op.drop_column('planned_purchases', 'source_recurring_id')
    if _column_exists(conn, 'transactions', 'source_planned_id'):
        op.drop_column('transactions', 'source_planned_id')
    if _table_exists(conn, 'budget_alert_log'):
        op.drop_table('budget_alert_log')
    if _table_exists(conn, 'planned_tags'):
        op.drop_table('planned_tags')
    if _table_exists(conn, 'recurring_transactions'):
        op.drop_table('recurring_transactions')
    if _table_exists(conn, 'budget_categories'):
        op.drop_table('budget_categories')
