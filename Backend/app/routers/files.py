"""
Files API
File upload, storage, and management
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
import os
import uuid
import shutil
import mimetypes
import logging

from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user

router = APIRouter(
    prefix="/files",
    tags=["Files"],
)

logger = logging.getLogger(__name__)

# Configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/moran_uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 10 * 1024 * 1024))  # 10MB default
ALLOWED_EXTENSIONS = {
    "image": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
    "document": [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"],
    "archive": [".zip", ".tar", ".gz"]
}


class FileMetadata(BaseModel):
    """File metadata response"""
    id: str
    filename: str
    original_filename: str
    mime_type: str
    size_bytes: int
    category: str
    uploaded_by: str
    uploaded_at: str
    url: str


class FileUploadResponse(BaseModel):
    """File upload response"""
    success: bool
    file: Optional[FileMetadata] = None
    error: Optional[str] = None


def _ensure_upload_dir(tenant_id: str) -> str:
    """Ensure tenant upload directory exists"""
    tenant_dir = os.path.join(UPLOAD_DIR, tenant_id)
    os.makedirs(tenant_dir, exist_ok=True)
    return tenant_dir


def _get_file_category(filename: str) -> str:
    """Determine file category from extension"""
    ext = os.path.splitext(filename)[1].lower()
    for category, extensions in ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            return category
    return "other"


def _is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    ext = os.path.splitext(filename)[1].lower()
    all_extensions = []
    for extensions in ALLOWED_EXTENSIONS.values():
        all_extensions.extend(extensions)
    return ext in all_extensions


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    category: Optional[str] = Query(None, description="File category: image, document, archive"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> FileUploadResponse:
    """
    Upload a single file
    
    Stores file locally and returns metadata with download URL
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        if not _is_allowed_file(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Allowed: {ALLOWED_EXTENSIONS}"
            )
        
        # Read file content to check size
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[1].lower()
        stored_filename = f"{file_id}{ext}"
        
        # Store file
        tenant_dir = _ensure_upload_dir(tenant_id)
        file_path = os.path.join(tenant_dir, stored_filename)
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(file.filename)
        if not mime_type:
            mime_type = "application/octet-stream"
        
        # Build metadata
        file_category = category or _get_file_category(file.filename)
        metadata = FileMetadata(
            id=file_id,
            filename=stored_filename,
            original_filename=file.filename,
            mime_type=mime_type,
            size_bytes=len(content),
            category=file_category,
            uploaded_by=current_user.get("email", "unknown"),
            uploaded_at=datetime.now().isoformat(),
            url=f"/api/tenants/{tenant_id}/files/{file_id}"
        )
        
        logger.info(f"File uploaded: {file_id} for tenant {tenant_id}")
        
        return FileUploadResponse(success=True, file=metadata)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        return FileUploadResponse(success=False, error=str(e))


@router.post("/upload-multiple")
async def upload_multiple_files(
    files: List[UploadFile] = File(...),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Upload multiple files at once
    
    Returns results for each file
    """
    results = []
    
    for file in files:
        try:
            result = await upload_file(
                file=file,
                category=None,
                tenant_id=tenant_id,
                current_user=current_user
            )
            results.append({
                "filename": file.filename,
                "success": result.success,
                "file": result.file.model_dump() if result.file else None,
                "error": result.error
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "file": None,
                "error": str(e)
            })
    
    successful = sum(1 for r in results if r["success"])
    
    return {
        "total": len(results),
        "successful": successful,
        "failed": len(results) - successful,
        "results": results
    }


@router.get("")
async def list_files(
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    List uploaded files
    
    Returns file metadata with pagination
    """
    try:
        tenant_dir = os.path.join(UPLOAD_DIR, tenant_id)
        
        if not os.path.exists(tenant_dir):
            return {"files": [], "total": 0}
        
        files = []
        for filename in os.listdir(tenant_dir):
            file_path = os.path.join(tenant_dir, filename)
            if os.path.isfile(file_path):
                file_id = os.path.splitext(filename)[0]
                stat = os.stat(file_path)
                mime_type, _ = mimetypes.guess_type(filename)
                file_category = _get_file_category(filename)
                
                if category and file_category != category:
                    continue
                
                files.append({
                    "id": file_id,
                    "filename": filename,
                    "size_bytes": stat.st_size,
                    "mime_type": mime_type or "application/octet-stream",
                    "category": file_category,
                    "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "url": f"/api/tenants/{tenant_id}/files/{file_id}"
                })
        
        # Sort by modification time (newest first)
        files.sort(key=lambda x: x["modified_at"], reverse=True)
        
        # Paginate
        total = len(files)
        files = files[offset:offset + limit]
        
        return {
            "files": files,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Failed to list files: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{file_id}")
async def get_file_metadata(
    file_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get file metadata
    
    Returns metadata without downloading the file
    """
    try:
        tenant_dir = os.path.join(UPLOAD_DIR, tenant_id)
        
        # Find file with matching ID
        for filename in os.listdir(tenant_dir):
            if filename.startswith(file_id):
                file_path = os.path.join(tenant_dir, filename)
                stat = os.stat(file_path)
                mime_type, _ = mimetypes.guess_type(filename)
                
                return {
                    "id": file_id,
                    "filename": filename,
                    "size_bytes": stat.st_size,
                    "mime_type": mime_type or "application/octet-stream",
                    "category": _get_file_category(filename),
                    "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "download_url": f"/api/tenants/{tenant_id}/files/{file_id}/download"
                }
        
        raise HTTPException(status_code=404, detail="File not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get file metadata: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """
    Download a file
    
    Returns the file content for download
    """
    try:
        tenant_dir = os.path.join(UPLOAD_DIR, tenant_id)
        
        # Find file with matching ID
        for filename in os.listdir(tenant_dir):
            if filename.startswith(file_id):
                file_path = os.path.join(tenant_dir, filename)
                mime_type, _ = mimetypes.guess_type(filename)
                
                return FileResponse(
                    path=file_path,
                    filename=filename,
                    media_type=mime_type or "application/octet-stream"
                )
        
        raise HTTPException(status_code=404, detail="File not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Delete a file
    
    Permanently removes the file from storage
    """
    try:
        tenant_dir = os.path.join(UPLOAD_DIR, tenant_id)
        
        # Find and delete file with matching ID
        for filename in os.listdir(tenant_dir):
            if filename.startswith(file_id):
                file_path = os.path.join(tenant_dir, filename)
                os.remove(file_path)
                
                logger.info(f"File deleted: {file_id} for tenant {tenant_id}")
                
                return {
                    "success": True,
                    "id": file_id,
                    "message": "File deleted successfully"
                }
        
        raise HTTPException(status_code=404, detail="File not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        raise HTTPException(status_code=500, detail=str(e))
