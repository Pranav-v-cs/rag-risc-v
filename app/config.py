from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    pdf_path: str = "data/riscv.pdf"
    chroma_db_path: str = "data/riscv_vector_db"
    sqlite_path: str = "data/chat.db"
    documents_dir: str = "data/documents"
    embed_model: str = "nomic-embed-text"
    llm_model: str = "llama3.2"
    chunk_size: int = 1500
    chunk_overlap: int = 200
    k_retrieval: int = 3
    max_history_exchanges: int = 10

    model_config = {"env_file": ".env"}


settings = Settings()
