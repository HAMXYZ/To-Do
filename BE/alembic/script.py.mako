"""Alembic migration script template.

This file is used by Alembic to create new revisions. The default template here is
simple and works with SQLAlchemy/SQLModel metadata autogeneration.
"""

from alembic import op
import sqlalchemy as sa


revision = "${up_revision}"
down_revision = ${down_revision|repr}
branch_labels = ${branch_labels}
depends_on = ${depends_on}


def upgrade():
    pass


def downgrade():
    pass
