"""notas permitir jefe como autor

Revision ID: a2fc59a3725b
Revises: 717edabfc785
Create Date: 2026-09-28 10:54:00.613146

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a2fc59a3725b'
down_revision = '717edabfc785'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("notas", "trabajadora_creadora_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("notas", sa.Column("creada_por_usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True))
    op.add_column("notas", sa.Column("resuelta_por_usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True))
    op.create_check_constraint(
        "ck_nota_autor",
        "notas",
        "trabajadora_creadora_id IS NOT NULL OR creada_por_usuario_id IS NOT NULL",
    )

def downgrade():
    op.drop_constraint("ck_nota_autor", "notas", type_="check")
    op.drop_column("notas", "resuelta_por_usuario_id")
    op.drop_column("notas", "creada_por_usuario_id")
    op.alter_column("notas", "trabajadora_creadora_id", existing_type=sa.Integer(), nullable=False)