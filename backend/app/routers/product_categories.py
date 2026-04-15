from fastapi import APIRouter

from app.services.product_category_service import PRODUCT_CATEGORY_MAP

router = APIRouter(tags=["product-categories"])


@router.get("/product-category-map")
async def get_product_category_map():
    return PRODUCT_CATEGORY_MAP
