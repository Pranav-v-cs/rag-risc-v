from pathlib import Path
import os

import ollama
from langchain_chroma import Chroma
from langchain_core.embeddings import Embeddings
from langchain_opendataloader_pdf import OpenDataLoaderPDFLoader
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

from app.config import settings


class LocalEmbeddings(Embeddings):
    def __init__(self, model):
        self.model = model

    def embed_documents(self, texts):
        embeddings = []
        for text in texts:
            response = ollama.embeddings(model=self.model, prompt=text)
            embeddings.append(response["embedding"])
        return embeddings

    def embed_query(self, text):
        response = ollama.embeddings(model=self.model, prompt=text)
        return response["embedding"]


def _get_vector_store():
    return Chroma(
        persist_directory=settings.chroma_db_path,
        embedding_function=LocalEmbeddings(settings.embed_model),
    )


def parse_and_chunk(filepath: str | Path):
    filepath = Path(filepath)
    if not filepath.is_file():
        return None

    loader = OpenDataLoaderPDFLoader(
        file_path=str(filepath), format="markdown", quiet=True
    )
    docs = loader.load()

    md = ""
    for doc in docs:
        md += doc.page_content

    headers_to_split_on = [
        ("#", "Chapter"),
        ("##", "Section"),
        ("###", "Sub_Section"),
        ("####", "Deep_Section"),
        ("#####", "Detail_1"),
        ("######", "Detail_2"),
    ]
    markdown_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers_to_split_on, strip_headers=False
    )
    header_chunks = markdown_splitter.split_text(md)

    safety_splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", " ", ""],
    )

    final_chunks = safety_splitter.split_documents(header_chunks)
    return final_chunks


def index_pdf(file_path: str, document_id: str) -> int:
    chunks = parse_and_chunk(file_path)
    if not chunks:
        return 0

    for chunk in chunks:
        chunk.metadata["document_id"] = document_id

    vector_store = _get_vector_store()
    vector_store.add_documents(chunks)
    return len(chunks)


def deindex_document(document_id: str) -> int:
    vector_store = _get_vector_store()
    results = vector_store.get(where={"document_id": document_id})
    ids = results.get("ids", [])
    if ids:
        vector_store.delete(ids)
    return len(ids)


def ingestion():
    try:
        if os.path.exists(settings.chroma_db_path):
            return

        filepath = Path(settings.pdf_path)
        if not filepath.is_file():
            return

        chunks = parse_and_chunk(str(filepath))
        if not chunks:
            return

        Chroma.from_documents(
            documents=chunks,
            embedding=LocalEmbeddings(model=settings.embed_model),
            persist_directory=settings.chroma_db_path,
        )
    except Exception:
        pass
