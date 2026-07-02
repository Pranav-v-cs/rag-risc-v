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


class LocalEmbeddings(Embeddings):
    def __init__(self, model):
        self.model = model

    def embed_documents(self, texts):
        embeddings = []

        for text in texts:
            response = ollama.embeddings(model=self.model, prompt=text)
            embeddings.append(response["embedding"])
        print("Embedding done...")
        return embeddings

    def embed_query(self, text):
        response = ollama.embeddings(model=self.model, prompt=text)
        return response["embedding"]


def parse_and_chunk():
    filepath = Path("data/riscv.pdf")
    if not filepath.is_file():
        print("File not found")
        return

    loader = OpenDataLoaderPDFLoader(file_path=filepath, format="markdown", quiet=True)
    docs = loader.load()

    md = ""

    for doc in docs:
        md += doc.page_content

    print("Parsing PDF Done...")

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
        chunk_size=1500, chunk_overlap=200, separators=["\n\n", "\n", " ", ""]
    )

    final_chunks = safety_splitter.split_documents(header_chunks)
    print("Chunking done...")
    return final_chunks


def ingestion():
    if os.path.exists("data/riscv_vector_db/"):
        return

    chunks = parse_and_chunk()
    if not chunks:
        return

    Chroma.from_documents(
        documents=chunks,
        embedding=LocalEmbeddings(model="nomic-embed-text"),
        persist_directory="./data/riscv_vector_db",
    )
    print("Vector DB created...")
