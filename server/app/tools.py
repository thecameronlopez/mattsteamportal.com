from decimal import Decimal, ROUND_HALF_UP

def parse_money_to_cents(raw_value: str) -> int:
    normalized = raw_value.replace(",", "").replace("$", "").strip()
    
    amount = Decimal(normalized)
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))