from decimal import InvalidOperation
from datetime import datetime, date
from zoneinfo import ZoneInfo
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from sqlalchemy import or_

from app.extensions import db
from app.models import RoleEnum
from app.models.receipts import Receipt
from app.tools import parse_money_to_cents
from app.services.receipts_service import send_receipt_email
from app.services.receipt_cleanup_service import (
    ReceiptCleanupError,
    cleanup_google_receipt_artifacts,
)

receipts_bp = Blueprint("receipts", __name__)


ALLOWED_EXTENSIONS = {"pdf", "png", "jpeg", "jpg"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".",1)[1].lower() in ALLOWED_EXTENSIONS

def get_business_today() -> date:
    tz_name = current_app.config.get("BUSINESS_TIMEZONE", "America/Chicago")
    return datetime.now(ZoneInfo(tz_name)).date()


def parse_from_bool(raw_value) -> bool:
    if raw_value is None:
        return False
    
    return str(raw_value).strip().lower() in {"true", "1", "yes", "on"}


def require_admin():
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403
    return None


def parse_optional_iso_date(raw_value):
    cleaned = (raw_value or "").strip()
    if not cleaned:
        return None
    return date.fromisoformat(cleaned)


def parse_receipt_amount(raw_value):
    if raw_value is None:
        raise ValueError("Amount is required")

    if isinstance(raw_value, int):
        return raw_value

    if isinstance(raw_value, float):
        return parse_money_to_cents(str(raw_value))

    cleaned = str(raw_value).strip()
    if not cleaned:
        raise ValueError("Amount is required")

    if cleaned.isdigit():
        return int(cleaned)

    return parse_money_to_cents(cleaned)


@receipts_bp.route("", methods=["GET"])
@login_required
def list_receipts():
    unauthorized = require_admin()
    if unauthorized:
        return unauthorized

    page = max(request.args.get("page", 1, type=int), 1)
    limit = min(max(request.args.get("limit", 20, type=int), 1), 100)
    status = (request.args.get("status") or "").strip().lower()
    search = (request.args.get("search") or "").strip()

    query = Receipt.query

    if status:
        query = query.filter(Receipt.receipt_status == status)

    if search:
        wildcard = f"%{search}%"
        query = query.filter(
            or_(
                Receipt.employee.ilike(wildcard),
                Receipt.vendor.ilike(wildcard),
                Receipt.uuid.ilike(wildcard),
                Receipt.reviewed_by.ilike(wildcard),
            )
        )

    total_items = query.count()
    total_pages = max((total_items + limit - 1) // limit, 1)
    page = min(page, total_pages)

    receipts = (
        query.order_by(Receipt.purchase_date.desc(), Receipt.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return jsonify(
        success=True,
        receipts=[receipt.serialize_summary() for receipt in receipts],
        pagination={
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
        },
    ), 200


@receipts_bp.route("/<int:receipt_id>", methods=["GET"])
@login_required
def get_receipt(receipt_id):
    unauthorized = require_admin()
    if unauthorized:
        return unauthorized

    receipt = Receipt.query.get(receipt_id)
    if not receipt:
        return jsonify(success=False, message="Receipt not found"), 404

    return jsonify(success=True, receipt=receipt.serialize()), 200


@receipts_bp.route("/<int:receipt_id>", methods=["PATCH"])
@login_required
def update_receipt(receipt_id):
    unauthorized = require_admin()
    if unauthorized:
        return unauthorized

    data = request.get_json()
    if not data:
        return jsonify(success=False, message="No input data provided"), 400

    receipt = Receipt.query.get(receipt_id)
    if not receipt:
        return jsonify(success=False, message="Receipt not found"), 404

    try:
        if "employee" in data:
            employee = (data.get("employee") or "").strip()
            if not employee:
                return jsonify(success=False, message="Employee is required"), 400
            receipt.employee = employee

        if "amount" in data:
            receipt.amount = parse_receipt_amount(data.get("amount"))

        if "method_used" in data:
            method_used = (data.get("method_used") or "").strip()
            if not method_used:
                return jsonify(success=False, message="Method used is required"), 400
            receipt.method_used = method_used

        if "submission_date" in data:
            receipt.submission_date = parse_optional_iso_date(data.get("submission_date"))
            if not receipt.submission_date:
                return jsonify(success=False, message="Submission date is required"), 400

        if "purchase_date" in data:
            receipt.purchase_date = parse_optional_iso_date(data.get("purchase_date"))
            if not receipt.purchase_date:
                return jsonify(success=False, message="Purchase date is required"), 400

        if "vendor" in data:
            vendor = (data.get("vendor") or "").strip()
            if not vendor:
                return jsonify(success=False, message="Vendor is required"), 400
            receipt.vendor = vendor

        if "business_reason" in data:
            business_reason = (data.get("business_reason") or "").strip()
            if not business_reason:
                return jsonify(success=False, message="Business reason is required"), 400
            receipt.business_reason = business_reason

        if "expense_category" in data:
            receipt.expense_category = (data.get("expense_category") or "").strip() or None

        if "po_required" in data:
            receipt.po_required = parse_from_bool(data.get("po_required"))

        if "po_number" in data:
            receipt.po_number = (data.get("po_number") or "").strip() or None

        if "work_order_number" in data:
            receipt.work_order_number = (
                (data.get("work_order_number") or "").strip() or None
            )

        if "receipt_status" in data:
            receipt_status = (data.get("receipt_status") or "").strip()
            if not receipt_status:
                return jsonify(success=False, message="Receipt status is required"), 400
            receipt.receipt_status = receipt_status

        if "external_file_url" in data:
            receipt.external_file_url = (data.get("external_file_url") or "").strip() or None

        if "external_file_id" in data:
            receipt.external_file_id = (data.get("external_file_id") or "").strip() or None

        if "missing_receipt" in data:
            receipt.missing_receipt = parse_from_bool(data.get("missing_receipt"))

        if "missing_receipt_reason" in data:
            receipt.missing_receipt_reason = (
                (data.get("missing_receipt_reason") or "").strip() or None
            )

        if "email_delivery_status" in data:
            receipt.email_delivery_status = (
                (data.get("email_delivery_status") or "").strip() or receipt.email_delivery_status
            )

        if "email_delivery_error" in data:
            receipt.email_delivery_error = (
                (data.get("email_delivery_error") or "").strip() or None
            )

        if "matched_to_statement" in data:
            receipt.matched_to_statement = parse_from_bool(data.get("matched_to_statement"))

        if "reviewed_by" in data:
            receipt.reviewed_by = (data.get("reviewed_by") or "").strip() or None

        if "reviewed_date" in data:
            receipt.reviewed_date = parse_optional_iso_date(data.get("reviewed_date"))

        if "notes" in data:
            receipt.notes = (data.get("notes") or "").strip() or None

        if not receipt.po_required:
            receipt.po_number = None

        if not receipt.missing_receipt:
            receipt.missing_receipt_reason = None

        receipt.validate()
        db.session.commit()

        return jsonify(
            success=True,
            message="Receipt updated successfully",
            receipt=receipt.serialize(),
        ), 200
    except (InvalidOperation, ValueError) as validation_error:
        db.session.rollback()
        return jsonify(success=False, message=str(validation_error)), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[RECEIPT UPDATE ERROR]: {e}")
        return jsonify(success=False, message="There was an error when updating the receipt."), 500


@receipts_bp.route("/<int:receipt_id>", methods=["DELETE"])
@login_required
def delete_receipt(receipt_id):
    unauthorized = require_admin()
    if unauthorized:
        return unauthorized

    receipt = Receipt.query.get(receipt_id)
    if not receipt:
        return jsonify(success=False, message="Receipt not found"), 404

    try:
        cleanup_result = cleanup_google_receipt_artifacts(receipt)
        db.session.delete(receipt)
        db.session.commit()
        return jsonify(
            success=True,
            message="Receipt deleted successfully",
            cleanup=cleanup_result,
        ), 200
    except ReceiptCleanupError as cleanup_error:
        current_app.logger.error(
            f"[RECEIPT GOOGLE CLEANUP ERROR]: {cleanup_error}"
        )
        return jsonify(
            success=False,
            message=str(cleanup_error),
        ), 502
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[RECEIPT DELETE ERROR]: {e}")
        return jsonify(success=False, message="There was an error when deleting the receipt."), 500



@receipts_bp.route("/submit", methods=["POST"])
@login_required
def submit_receipt():
    form = request.form
    file = request.files.get("receipt")

    try:
        missing_receipt = parse_from_bool(form.get("missing_receipt"))

        employee = form.get("employee", "").strip()
        method_used = form.get("method_used", "").strip()
        vendor = form.get("vendor", "").strip()
        business_reason = form.get("business_reason", "").strip()
        missing_receipt_reason = form.get("missing_receipt_reason", "").strip()

        if not employee:
            return jsonify(success=False, message="Employee is required"), 400
        if not method_used:
            return jsonify(success=False, message="Method used is required"), 400
        if not vendor:
            return jsonify(success=False, message="Vendor is required"), 400
        if not business_reason:
            return jsonify(success=False, message="Business reason is required"), 400

        purchase_date_raw = form.get("purchase_date", "").strip()
        if not purchase_date_raw:
            return jsonify(success=False, message="Purchase date is required"), 400

        try:
            purchase_date = date.fromisoformat(purchase_date_raw)
        except ValueError:
            return jsonify(
                success=False,
                message="Invalid purchase date format. Use YYYY-MM-DD",
            ), 400

        amount_raw = form.get("amount", "").strip()
        if not amount_raw:
            return jsonify(success=False, message="Amount is required"), 400

        try:
            amount = parse_money_to_cents(amount_raw)
        except (InvalidOperation, ValueError):
            return jsonify(success=False, message="Invalid amount"), 400

        if not missing_receipt:
            if not file or not file.filename:
                return jsonify(success=False, message="Receipt file is required"), 400

            if not allowed_file(file.filename):
                return jsonify(success=False, message="Unsupported file type"), 400

        receipt = Receipt(
            employee=employee,
            amount=amount,
            method_used=method_used,
            submission_date=get_business_today(),
            purchase_date=purchase_date,
            vendor=vendor,
            business_reason=business_reason,
            expense_category=form.get("expense_category", "").strip() or None,
            po_required=parse_from_bool(form.get("po_required")),
            po_number=form.get("po_number", "").strip() or None,
            work_order_number=form.get("work_order_number", "").strip() or None,
            missing_receipt=missing_receipt,
            missing_receipt_reason=missing_receipt_reason or None,
            email_delivery_status="pending",
            email_delivery_error=None,
            external_file_url=None,
            external_file_id=None,
        )

        try:
            receipt.validate()
        except ValueError as validation_error:
            return jsonify(
                success=False,
                message=str(validation_error)
            ), 400

        db.session.add(receipt)
        db.session.commit()

        try:
            send_receipt_email(receipt, file if not missing_receipt else None)
            receipt.email_delivery_status = "sent"
            receipt.email_delivery_error = None
            db.session.commit()
            
            success_message = (
                "Missing receipt submitted!"
                if missing_receipt
                else "Receipt Submitted!"
            )

            return jsonify(
                success=True,
                message=success_message,
                receipt_id=receipt.id,
                email_delivery_status=receipt.email_delivery_status,
            ), 201

        except Exception as email_error:
            current_app.logger.error(f"[RECEIPT EMAIL ERROR]: {email_error}")
            
            try: 
                receipt.email_delivery_status = "failed"
                receipt.email_delivery_error = str(email_error)
                db.session.commit()
            except Exception as status_error:
                db.session.rollback()
                current_app.logger.error(
                    f"[RECEIPT EMAIL STATUS UPDATE ERROR]: {status_error}"
                )
                
            warning_message = (
                "Missing receipt was saved, but the notification email failed to send"
                if missing_receipt
                else "Receipt was saved, but the attachement email failed to send"
            )

            return jsonify(
                success=True,
                message=warning_message,
                receipt_id=receipt.id,
                email_delivery_status=receipt.email_delivery_status,
                warning="Email delivery failed. This receipt may need manual follow-up.",
            ), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[RECEIPT SUBMISSION ERROR]: {e}")
        return jsonify(
            success=False,
            message="There was an error when submitting the receipt.",
        ), 500

