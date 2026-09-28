"""crear tabla precios especiales

Revision ID: 80aa48e04739
Revises: 83a39f630a80
Create Date: 2026-09-28 17:09:23.098810

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '80aa48e04739'
down_revision = '83a39f630a80'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "precios_especiales",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes.id"), nullable=False),
        sa.Column("producto_id", sa.Integer(), sa.ForeignKey("productos.id"), nullable=False),
        sa.Column("precio", sa.Numeric(10, 2), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("cliente_id", "producto_id", name="uq_precio_especial_cliente_producto"),
    )

def downgrade():
    op.drop_table("precios_especiales")