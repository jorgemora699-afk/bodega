"""crear tabla notas

Revision ID: 49adca1c1c34
Revises: eabc8ed5a74a
Create Date: 2026-09-26 23:30:34.759075

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '49adca1c1c34'
down_revision = 'eabc8ed5a74a'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("trabajadora_creadora_id", sa.Integer(), sa.ForeignKey("trabajadoras.id"), nullable=False),
        sa.Column("creada_en", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("resuelta", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("trabajadora_resuelve_id", sa.Integer(), sa.ForeignKey("trabajadoras.id"), nullable=True),
        sa.Column("resuelta_en", sa.DateTime(), nullable=True),
    )

def downgrade():
    op.drop_table("notas")