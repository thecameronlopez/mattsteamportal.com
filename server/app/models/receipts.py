from datetime import datetime, date
import uuid

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import (
    String,
    Date,
    Boolean,
    Integer,
    Text,
    DateTime,
    func,
    CheckConstraint,
)

from app.extensions import db


class Receipt(db.Model):
    __tablename__ = "receipts"

    __table_args__ = (
        CheckConstraint(
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
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(
        String(36),
        unique=True,
        nullable=False,
        default=lambda: str(uuid.uuid4()),
    )

    employee: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # cents
    method_used: Mapped[str] = mapped_column(String(120), nullable=False)
    submission_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    vendor: Mapped[str] = mapped_column(String(120), nullable=False)
    business_reason: Mapped[str] = mapped_column(Text, nullable=False)

    expense_category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    po_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    po_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    work_order_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    receipt_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="submitted",
    )

    external_file_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_file_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    missing_receipt: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    missing_receipt_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    email_delivery_status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    email_delivery_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    matched_to_statement: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reviewed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reviewed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now(),
    )

    def validate(self):
        if self.missing_receipt:
            if not self.missing_receipt_reason:
                raise ValueError(
                    "missing_receipt_reason is required when missing_receipt is true."
                )

    def serialize(self):
        return {
            "id": self.id,
            "uuid": self.uuid,
            "employee": self.employee,
            "amount": self.amount,
            "method_used": self.method_used,
            "submission_date": self.submission_date.isoformat(),
            "purchase_date": self.purchase_date.isoformat(),
            "vendor": self.vendor,
            "business_reason": self.business_reason,
            "expense_category": self.expense_category,
            "po_required": self.po_required,
            "po_number": self.po_number,
            "work_order_number": self.work_order_number,
            "receipt_status": self.receipt_status,
            "external_file_url": self.external_file_url,
            "external_file_id": self.external_file_id,
            "missing_receipt": self.missing_receipt,
            "missing_receipt_reason": self.missing_receipt_reason,
            "email_delivery_status": self.email_delivery_status,
            "email_delivery_error": self.email_delivery_error,
            "matched_to_statement": self.matched_to_statement,
            "reviewed_by": self.reviewed_by,
            "reviewed_date": (
                self.reviewed_date.isoformat() if self.reviewed_date else None
            ),
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def serialize_summary(self):
        return {
            "id": self.id,
            "uuid": self.uuid,
            "employee": self.employee,
            "amount": self.amount,
            "purchase_date": self.purchase_date.isoformat(),
            "vendor": self.vendor,
            "missing_receipt": self.missing_receipt,
            "receipt_status": self.receipt_status,
            "email_delivery_status": self.email_delivery_status,
            "matched_to_statement": self.matched_to_statement,
            "reviewed_by": self.reviewed_by,
            "reviewed_date": (
                self.reviewed_date.isoformat() if self.reviewed_date else None
            ),
            "updated_at": self.updated_at.isoformat(),
        }

