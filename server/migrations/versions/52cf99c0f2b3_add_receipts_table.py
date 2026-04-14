"""add receipts table

Revision ID: 52cf99c0f2b3
Revises: 3678e07c71d1
Create Date: 2026-04-13 14:08:40.434406

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "52cf99c0f2b3"
down_revision = "3678e07c71d1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "receipts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("employee", sa.String(length=120), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("method_used", sa.String(length=120), nullable=False),
        sa.Column("submission_date", sa.Date(), nullable=False),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("vendor", sa.String(length=120), nullable=False),
        sa.Column("business_reason", sa.Text(), nullable=False),
        sa.Column("expense_category", sa.String(length=120), nullable=True),
        sa.Column("po_required", sa.Boolean(), nullable=False),
        sa.Column("po_number", sa.String(length=100), nullable=True),
        sa.Column("work_order_number", sa.String(length=100), nullable=True),
        sa.Column("receipt_status", sa.String(length=50), nullable=False),
        sa.Column("external_file_url", sa.Text(), nullable=True),
        sa.Column("external_file_id", sa.String(length=255), nullable=True),
        sa.Column("missing_receipt", sa.Boolean(), nullable=False),
        sa.Column("missing_receipt_reason", sa.Text(), nullable=True),
        sa.Column("email_delivery_status", sa.String(length=50), nullable=False),
        sa.Column("email_delivery_error", sa.Text(), nullable=True),
        sa.Column("matched_to_statement", sa.Boolean(), nullable=False),
        sa.Column("reviewed_by", sa.String(length=120), nullable=True),
        sa.Column("reviewed_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            """
            (
                missing_receipt = true
                AND missing_receipt_reason IS NOT NULL
            )
            OR
            (
                missing_receipt = false
            )
            """,
            name="ck_receipt_missing_reason_required",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )


def downgrade():
    op.drop_table("receipts")
