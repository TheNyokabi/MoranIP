from fastapi import APIRouter

router = APIRouter(tags=["Collections"])

@router.get("/health")
def collections_health():
    return {
        "engine": "collections",
        "status": "ok",
        "version": "v1"
    }
