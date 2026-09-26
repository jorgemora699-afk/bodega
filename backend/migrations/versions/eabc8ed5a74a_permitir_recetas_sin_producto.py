"""permitir recetas sin producto

Revision ID: eabc8ed5a74a
Revises: c66c27a7dcf7
Create Date: 2026-09-26 15:12:44.971886

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'eabc8ed5a74a'
down_revision = 'c66c27a7dcf7'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("recetas", "producto_id", nullable=True)
    op.add_column("recetas", sa.Column("nombre", sa.String(150), nullable=True))
    op.create_check_constraint(
        "ck_receta_producto_o_nombre",
        "recetas",
        "producto_id IS NOT NULL OR nombre IS NOT NULL",
    )

def downgrade():
    op.drop_constraint("ck_receta_producto_o_nombre", "recetas", type_="check")
    op.drop_column("recetas", "nombre")
    op.alter_column("recetas", "producto_id", nullable=False)