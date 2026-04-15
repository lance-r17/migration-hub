PRODUCT_CATEGORY_MAP = [
    {"product": "ecs",     "category": "VM"},
    {"product": "rds",     "category": "Database"},
    {"product": "polarDB", "category": "Database"},
    {"product": "redis",   "category": "Database"},
    {"product": "oss",     "category": "Buckets"},
    {"product": "slb",     "category": "Network"},
    {"product": "dns",     "category": "Network"},
    {"product": "sls",     "category": "Other"},
    {"product": "Other",   "category": "Other"},
]

_PRODUCT_TO_CATEGORY = {e["product"]: e["category"] for e in PRODUCT_CATEGORY_MAP}


def get_category_for_product(product: str | None) -> str:
    return _PRODUCT_TO_CATEGORY.get(product or "Other", "Other")
