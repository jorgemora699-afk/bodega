"""agregar stock_minimo a productos

Revision ID: c66c27a7dcf7
Revises: 63ef96c7a5b8
Create Date: 2026-09-26 14:24:31.751320

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c66c27a7dcf7'
down_revision = '63ef96c7a5b8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "productos",
        sa.Column("stock_minimo", sa.Numeric(10, 3), nullable=False, server_default="5"),
    )

def downgrade():
    op.drop_column("productos", "stock_minimo")