import ollama
from langchain_chroma import Chroma
from ingestion import LocalEmbeddings

DB_PATH = "data/riscv_vector_db"


def query(text):
    embedding = LocalEmbeddings("nomic-embed-text")
    vector_store = Chroma(
        persist_directory=DB_PATH,
        embedding_function=embedding,
    )

    matches = vector_store.similarity_search(text, k=3)

    context = "\n\n---\n\n".join([doc.page_content for doc in matches])

    system_prompt = (
        "You are an expert RISC-V Computer Architecture Engineer.\n"
        "Answer the user's question using ONLY the provided documentation context below.\n"
        "Assume the user is beginner in computer Architecture. The user wishes to build an OS from scratch and is thus asing you for help.\n"
        "If the answer cannot be found in the context, say 'I cannot find that in the manual.'\n\n"
        f"--- OFFICIAL DOCUMENTATION CONTEXT ---\n{context}"
    )
    response = ollama.chat(
        model="llama3.2",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
    )

    return response["message"]["content"]
