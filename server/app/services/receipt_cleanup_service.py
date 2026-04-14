import requests
from flask import current_app


class ReceiptCleanupError(Exception):
    pass


def cleanup_google_receipt_artifacts(receipt) -> dict:
    webhook_url = current_app.config.get("RECEIPT_AUTOMATION_WEBHOOK_URL")
    automation_token = current_app.config.get("RECEIPT_AUTOMATION_TOKEN")

    if not webhook_url:
        raise ReceiptCleanupError(
            "Receipt automation webhook URL is not configured."
        )

    if not automation_token:
        raise ReceiptCleanupError(
            "Receipt automation token is not configured."
        )

    payload = {
        "token": automation_token,
        "action": "delete_receipt_artifacts",
        "receipt_id": receipt.id,
        "receipt_uuid": receipt.uuid,
    }

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=20,
        )
    except requests.RequestException as exc:
        raise ReceiptCleanupError(
            f"Could not reach the receipt automation service: {exc}"
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise ReceiptCleanupError(
            "Receipt automation service returned a non-JSON response."
        ) from exc

    if not response.ok or not data.get("success"):
        raise ReceiptCleanupError(
            data.get("message")
            or "Receipt automation service could not delete Google-side artifacts."
        )

    return data
