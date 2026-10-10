from datetime import datetime, timezone
import json

import ollama
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, func, select
from starlette.responses import StreamingResponse

from app.config import settings
from app.database import get_session, init_db, new_session
from app.documents import router as documents_router
from app.ingestion import ingestion
from app.models import Chat, ChatDocument, Message, Document
from app.query import prepare_context, query


class AskRequest(BaseModel):
    query: str
    chat_id: str
    k: int | None = None
    stream: bool = False


class CreateChatRequest(BaseModel):
    title: str | None = None
    document_ids: list[str] | None = None


app = FastAPI()
app.include_router(documents_router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    status = {"ollama": False, "chroma": False, "database": False}

    try:
        ollama.list()
        status["ollama"] = True
    except Exception:
        pass

    import os
    status["chroma"] = os.path.exists(settings.chroma_db_path)

    from app.database import engine
    try:
        engine.connect()
        status["database"] = True
    except Exception:
        pass

    return status


@app.post("/chats")
def create_chat(body: CreateChatRequest, session: Session = Depends(get_session)):
    chat = Chat(title=body.title or "")
    session.add(chat)
    session.commit()
    session.refresh(chat)

    if body.document_ids:
        for doc_id in body.document_ids:
            session.add(ChatDocument(chat_id=chat.id, document_id=doc_id))
        session.commit()

    return chat


@app.get("/chats")
def list_chats(session: Session = Depends(get_session)):
    chats = session.exec(
        select(
            Chat,
            func.count(Message.id).label("message_count"),
        )
        .outerjoin(Message, Message.chat_id == Chat.id)
        .group_by(Chat.id)
        .order_by(Chat.updated_at.desc())
    ).all()

    result = []
    for chat, count in chats:
        result.append({
            "id": chat.id,
            "title": chat.title,
            "message_count": count,
            "created_at": chat.created_at,
            "updated_at": chat.updated_at,
        })
    return result


@app.get("/chats/{chat_id}")
def get_chat(chat_id: str, session: Session = Depends(get_session)):
    chat = session.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = session.exec(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at)
    ).all()

    return {"chat": chat, "messages": messages}


@app.get("/chats/{chat_id}/documents")
def get_chat_documents(chat_id: str, session: Session = Depends(get_session)):
    chat = session.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    links = session.exec(
        select(ChatDocument).where(ChatDocument.chat_id == chat_id)
    ).all()
    doc_ids = [link.document_id for link in links]
    docs = session.exec(select(Document).where(Document.id.in_(doc_ids))).all() if doc_ids else []
    return docs


class SetDocumentsRequest(BaseModel):
    document_ids: list[str]


@app.put("/chats/{chat_id}/documents")
def set_chat_documents(
    chat_id: str, body: SetDocumentsRequest, session: Session = Depends(get_session)
):
    chat = session.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    existing = session.exec(
        select(ChatDocument).where(ChatDocument.chat_id == chat_id)
    ).all()
    for link in existing:
        session.delete(link)

    for doc_id in body.document_ids:
        session.add(ChatDocument(chat_id=chat_id, document_id=doc_id))

    session.commit()
    return {"ok": True}


@app.delete("/chats/{chat_id}")
def delete_chat(chat_id: str, session: Session = Depends(get_session)):
    chat = session.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = session.exec(
        select(Message).where(Message.chat_id == chat_id)
    ).all()
    for msg in messages:
        session.delete(msg)

    links = session.exec(
        select(ChatDocument).where(ChatDocument.chat_id == chat_id)
    ).all()
    for link in links:
        session.delete(link)

    session.delete(chat)
    session.commit()
    return {"ok": True}


def _save_messages(chat_id: str, query_text: str, answer: str, sources):
    now = datetime.now(timezone.utc)
    with new_session() as db_session:
        chat = db_session.get(Chat, chat_id)
        if not chat:
            return
        db_session.add(
            Message(
                chat_id=chat_id, role="user", content=query_text, created_at=now
            )
        )
        db_session.add(
            Message(
                chat_id=chat_id,
                role="assistant",
                content=answer,
                sources=json.dumps(sources, default=str),
                model=settings.llm_model,
                created_at=now,
            )
        )
        if not chat.title:
            chat.title = (
                query_text[:60] + ("..." if len(query_text) > 60 else "")
            )
        chat.updated_at = now
        db_session.commit()


@app.post("/ask")
def ask(body: AskRequest, session: Session = Depends(get_session)):
    chat = session.get(Chat, body.chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    chat_doc_links = session.exec(
        select(ChatDocument).where(ChatDocument.chat_id == body.chat_id)
    ).all()
    if not chat_doc_links:
        raise HTTPException(
            status_code=400,
            detail="No documents selected for this chat. Please select documents before asking questions.",
        )

    if body.stream:
        system_prompt, sources = prepare_context(
            text=body.query, chat_id=body.chat_id, session=session, k=body.k
        )

        def generate():
            full_answer = ""
            try:
                yield f"data: {json.dumps({'type': 'start'})}\n\n"

                stream = ollama.chat(
                    model=settings.llm_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": body.query},
                    ],
                    stream=True,
                )

                for chunk in stream:
                    token = chunk["message"]["content"]
                    full_answer += token
                    yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

                yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

                _save_messages(body.chat_id, body.query, full_answer, sources)
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")

    try:
        answer, sources = query(
            text=body.query,
            chat_id=body.chat_id,
            session=session,
            k=body.k,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Query failed: {str(e)}"
        )

    _save_messages(body.chat_id, body.query, answer, sources)
    return {"answer": answer, "sources": sources, "chat_id": body.chat_id}


@app.post("/ingest")
def ingest():
    try:
        ingestion()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ingestion failed: {str(e)}"
        )
