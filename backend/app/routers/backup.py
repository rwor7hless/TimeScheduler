from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.services.backup import list_backups, run_backup

router = APIRouter(prefix="/api/backup", tags=["backup"], dependencies=[Depends(get_current_user)])


@router.post("/trigger")
async def trigger_backup():
    try:
        filename = await run_backup()
        return {"status": "ok", "filename": filename}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def get_backups():
    return list_backups()
