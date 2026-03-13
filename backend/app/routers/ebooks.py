import os
import shutil
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Ebook
from app.schemas import EbookResponse, ConvertResponse
from app.auth import get_current_user
from app.config import settings
from services.converter import convert_pdf_to_epub

router = APIRouter(prefix="/api/ebooks", tags=["ebooks"])


def get_file_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower().replace(".", "")


def allowed_file(filename: str) -> bool:
    allowed_extensions = {"pdf", "epub", "mobi"}
    return get_file_extension(filename) in allowed_extensions


@router.get("", response_model=List[EbookResponse])
def list_ebooks(
    search: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Ebook).filter(Ebook.owner_id == current_user.id)

    if search:
        query = query.filter(
            (Ebook.title.ilike(f"%{search}%")) | (Ebook.author.ilike(f"%{search}%"))
        )

    return query.order_by(Ebook.created_at.desc()).all()


@router.get("/{ebook_id}", response_model=EbookResponse)
def get_ebook(
    ebook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ebook = (
        db.query(Ebook)
        .filter(Ebook.id == ebook_id, Ebook.owner_id == current_user.id)
        .first()
    )

    if not ebook:
        raise HTTPException(status_code=404, detail="Ebook not found")

    return ebook


@router.post("", response_model=EbookResponse, status_code=status.HTTP_201_CREATED)
async def upload_ebook(
    file: UploadFile = File(...),
    title: str = "",
    author: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not allowed_file(file.filename):
        raise HTTPException(
            status_code=400, detail="Invalid file format. Allowed: pdf, epub, mobi"
        )

    file_extension = get_file_extension(file.filename)

    if not title:
        title = os.path.splitext(file.filename)[0]

    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(file_path)

    ebook = Ebook(
        title=title,
        author=author,
        filename=file.filename,
        file_path=file_path,
        file_format=file_extension,
        file_size=file_size,
        owner_id=current_user.id,
    )

    db.add(ebook)
    db.commit()
    db.refresh(ebook)

    return ebook


@router.get("/{ebook_id}/download")
def download_ebook(
    ebook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ebook = (
        db.query(Ebook)
        .filter(Ebook.id == ebook_id, Ebook.owner_id == current_user.id)
        .first()
    )

    if not ebook:
        raise HTTPException(status_code=404, detail="Ebook not found")

    if not os.path.exists(ebook.file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=ebook.file_path,
        filename=ebook.filename,
        media_type="application/octet-stream",
    )


@router.post("/{ebook_id}/convert", response_model=ConvertResponse)
def convert_ebook(
    ebook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ebook = (
        db.query(Ebook)
        .filter(Ebook.id == ebook_id, Ebook.owner_id == current_user.id)
        .first()
    )

    if not ebook:
        raise HTTPException(status_code=404, detail="Ebook not found")

    if ebook.file_format != "pdf":
        return ConvertResponse(
            success=False, message="Only PDF files can be converted to EPUB"
        )

    if not os.path.exists(ebook.file_path):
        raise HTTPException(status_code=404, detail="Original file not found")

    success, message, converted_filename = convert_pdf_to_epub(
        pdf_path=ebook.file_path,
        output_dir=settings.UPLOAD_DIR,
        title=ebook.title,
        author=ebook.author or "Unknown",
    )

    if not success:
        return ConvertResponse(success=False, message=message)

    converted_file_path = os.path.join(settings.UPLOAD_DIR, converted_filename)
    file_size = os.path.getsize(converted_file_path)

    new_ebook = Ebook(
        title=f"{ebook.title} (EPUB)",
        author=ebook.author,
        filename=f"{ebook.title}.epub",
        file_path=converted_file_path,
        file_format="epub",
        file_size=file_size,
        owner_id=current_user.id,
    )

    db.add(new_ebook)
    db.commit()
    db.refresh(new_ebook)

    return ConvertResponse(
        success=True,
        message="PDF converted to EPUB successfully",
        converted_filename=converted_filename,
    )


@router.delete("/{ebook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ebook(
    ebook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ebook = (
        db.query(Ebook)
        .filter(Ebook.id == ebook_id, Ebook.owner_id == current_user.id)
        .first()
    )

    if not ebook:
        raise HTTPException(status_code=404, detail="Ebook not found")

    if os.path.exists(ebook.file_path):
        os.remove(ebook.file_path)

    db.delete(ebook)
    db.commit()

    return None
