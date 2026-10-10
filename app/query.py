import ollama
from langchain_chroma import Chroma
from sqlmodel import Session, select

from app.config import settings
from app.ingestion import LocalEmbeddings
from app.models import ChatDocument, Message


def prepare_context(
    text: str,
    chat_id: str,
    session: Session,
    k: int | None = None,
):
    history = session.exec(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at.desc())
        .limit(settings.max_history_exchanges * 2)
    ).all()
    history.reverse()

    history_text = "\n".join(
        f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}" for m in history
    )

    links = session.exec(
        select(ChatDocument).where(ChatDocument.chat_id == chat_id)
    ).all()
    doc_ids = [link.document_id for link in links]

    embedding = LocalEmbeddings(settings.embed_model)
    vector_store = Chroma(
        persist_directory=settings.chroma_db_path,
        embedding_function=embedding,
    )

    k = k or settings.k_retrieval
    where_filter = {"document_id": {"$in": doc_ids}} if doc_ids else None
    matches = vector_store.similarity_search(text, k=k, filter=where_filter)

    context = "\n\n---\n\n".join([doc.page_content for doc in matches])

    system_prompt = (
        "You are a technical documentation expert.\n"
        "You are good at reading through the technical docs and answering in a beginner friendly, intuitve way to the questions of the users.\n"
        "Go through the techincal documentation provided so as to provide highly effective answer.\n"
        "Answer the user's question using ONLY the provided documentation context below.\n"
        "If the answer cannot be found in the context, say 'I cannot find that in the manual.'\n\n"
        f"--- CONVERSATION HISTORY ---\n{history_text}\n\n"
        f"--- OFFICIAL DOCUMENTATION CONTEXT ---\n{context}"
    )

    sources = [doc.metadata for doc in matches]
    return system_prompt, sources


def query(
    text: str,
    chat_id: str,
    session: Session,
    k: int | None = None,
):
    system_prompt, sources = prepare_context(
        text=text, chat_id=chat_id, session=session, k=k
    )

    response = ollama.chat(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
    )

    answer = response["message"]["content"]
    return answer, sources
