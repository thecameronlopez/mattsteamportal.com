from flask_mailman import EmailMessage
from werkzeug.datastructures import FileStorage
from flask import current_app
from app.models import Receipt

from typing import Optional




def build_receipt_email_subject(receipt: Receipt) -> str:
    return (
        f"Receipt Submission | "
        f"ID: {receipt.id} | "
        f"UUID: {receipt.uuid} | "
        f"Vendor: {receipt.vendor}"
    )
    
    
def build_receipt_email_body(receipt: Receipt) -> str:
    return f"""\
Receipt DB ID: {receipt.id}
Receipt UUID: {receipt.uuid}
Employee: {receipt.employee}
Amount: {receipt.amount / 100:.2f}
Method Used: {receipt.method_used}
Submission Date: {receipt.submission_date.isoformat()}
Purchase Date: {receipt.purchase_date.isoformat()}
Vendor: {receipt.vendor}
Business Reason: {receipt.business_reason}
Expense Category: {receipt.expense_category or ""}
PO Required: {"Yes" if receipt.po_required else "No"}
PO Number: {receipt.po_number or ""}
Work Order Number: {receipt.work_order_number or ""}
Missing Receipt: {"Yes" if receipt.missing_receipt else "No"}
Missing Receipt Reason: {receipt.missing_receipt_reason or ""}

External File URL: {receipt.external_file_url or ""}
External File ID: {receipt.external_file_id or ""}
"""

def send_receipt_email(receipt: Receipt, file_storage: Optional[FileStorage] = None) -> None:
    
    subject = build_receipt_email_subject(receipt)
    body = build_receipt_email_body(receipt)
    
    message = EmailMessage(
        subject=subject,
        body=body,
        to=[current_app.config.get("RECEIPTS_EMAIL", "receipts@mattsappliancesla.net")],
    )
    
    if file_storage and file_storage.filename:
        attachment_bytes = file_storage.read()
        file_storage.stream.seek(0)
    
        message.attach(
            file_storage.filename,
            attachment_bytes,
            file_storage.mimetype or "application/octet-stream",
        )
    
    message.send()