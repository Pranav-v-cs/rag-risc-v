from datetime import datetime, timezone
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.ingestion import index_pdf, deindex_document
from app.models import Document

router = APIRouter(prefix="/documents", tags=["documents"])


class RenameRequest(BaseModel):
    title: str


@router.get("")
def list_documents(session: Session = Depends(get_session)):
    docs = session.exec(
        select(Document).order_by(Document.created_at.desc())
    ).all()
    return docs


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    session: Session = Depends(get_session),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    docs_dir = Path(settings.documents_dir)
    docs_dir.mkdir(parents=True, exist_ok=True)

    doc_id = str(uuid.uuid4())
    saved_name = f"{doc_id}.pdf"
    file_path = docs_dir / saved_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    try:
        chunk_count = index_pdf(str(file_path), doc_id)
    except Exception as e:
        if file_path.is_file():
            file_path.unlink()
        detail = str(e)
        if "connect" in detail.lower() or "refused" in detail.lower():
            raise HTTPException(502, "Could not connect to Ollama. Make sure it is running.")
        raise HTTPException(500, f"Failed to index document: {detail}")

    doc = Document(
        id=doc_id,
        filename=file.filename,
        title=title or file.filename.rsplit(".", 1)[0],
        file_path=str(file_path),
        chunk_count=chunk_count,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


@router.patch("/{doc_id}")
def rename_document(
    doc_id: str,
    body: RenameRequest,
    session: Session = Depends(get_session),
):
    doc = session.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    doc.title = body.title
    doc.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(doc)
    return doc


@router.get("/{doc_id}/download")
def download_document(doc_id: str, session: Session = Depends(get_session)):
    doc = session.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    file_path = Path(doc.file_path)
    if not file_path.is_file():
        raise HTTPException(404, "File not found on disk")

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=doc.filename,
    )


@router.delete("/{doc_id}")
def delete_document(doc_id: str, session: Session = Depends(get_session)):
    doc = session.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    deindex_document(doc_id)

    file_path = Path(doc.file_path)
    if file_path.is_file():
        file_path.unlink()

    session.delete(doc)
    session.commit()
    return {"ok": True}
