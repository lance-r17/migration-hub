PRODUCT_CATEGORY_MAP = [
    {"product": "ecs",            "product_name": "Elastic Compute Service",         "category": "computing"},
    {"product": "ess",            "product_name": "Auto Scaling",                    "category": "computing"},
    {"product": "cs",             "product_name": "Container Service for Kubernetes", "category": "computing"},
    {"product": "cr-ee",          "product_name": "Container Registry",              "category": "computing"},
    {"product": "kms",            "product_name": "Key Management Service",          "category": "security"},
    {"product": "vpc",            "product_name": "Virtual Private Cloud",           "category": "networking"},
    {"product": "slb",            "product_name": "Server Load Balancer",            "category": "networking"},
    {"product": "clouddns",       "product_name": "Cloud DNS",                       "category": "networking"},
    {"product": "polardb",        "product_name": "PolarDB",                         "category": "database"},
    {"product": "rds",            "product_name": "RDS",                             "category": "database"},
    {"product": "r-kvstore",      "product_name": "Redis",                           "category": "database"},
    {"product": "dds",            "product_name": "MongoDB",                         "category": "database"},
    {"product": "oss",            "product_name": "Object Storage Service",          "category": "storage"},
    {"product": "sls",            "product_name": "Simple Log Service",              "category": "storage"},
    {"product": "rocketmq",       "product_name": "Rocket MQ",                       "category": "middleware"},
    {"product": "dataworks",      "product_name": "DataWorks",                       "category": "analytics-computing"},
    {"product": "quickbi-public", "product_name": "QuickBI",                         "category": "analytics-computing"},
    {"product": "maxcompute",     "product_name": "MaxCompute",                      "category": "analytics-computing"},
    {"product": "cms",            "product_name": "Cloud Monitor",                   "category": "monitoring"},
]

_PRODUCT_TO_CATEGORY = {e["product"]: e["category"] for e in PRODUCT_CATEGORY_MAP}
_PRODUCT_TO_NAME = {e["product"]: e["product_name"] for e in PRODUCT_CATEGORY_MAP}


def get_category_for_product(product: str | None) -> str:
    return _PRODUCT_TO_CATEGORY.get(product or "", "computing")
