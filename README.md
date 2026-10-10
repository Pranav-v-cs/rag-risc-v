# RISC-V RAG

A local, fully offline Retrieval-Augmented Generation (RAG) assistant for the RISC-V instruction set. Ask natural-language questions about the RISC-V specification and get answers grounded in the official documentation, streamed token-by-token with source citations.

The backend runs a retrieval pipeline over a ChromaDB vector store using Ollama for both embeddings and generation, while a React UI provides chat history and per-document management.

## Features

- **Document management** — upload PDFs, rename, download, and delete them. Each upload is parsed, chunked, and indexed automatically.
- **Per-chat document scoping** — attach one or more documents to a chat so answers are retrieved only from the relevant sources.
- **Streaming answers** — responses are streamed over Server-Sent Events (SSE) as they are generated.
- **Source citations** — every answer is stored with the retrieved chunks it was grounded in.
- **Conversation history** — chats and messages persist in SQLite, with prior exchanges included as context.
- **Grounded prompting** — the model is instructed to answer *only* from retrieved context and to say so when it cannot find an answer.
- **Health checks & dark mode** — `/health` reports Ollama, Chroma, and database status; the UI supports a dark theme.

## Architecture

```
                 ┌─────────────┐        ┌──────────────────────┐
   PDF upload ──▶│  FastAPI    │───────▶│  OpenDataLoader PDF   │
                 │  backend    │        │  → markdown splitter  │
                 └──────┬──────┘        └──────────┬───────────┘
                        │                          │ chunks
                        │                          ▼
                        │                ┌──────────────────┐
                        │                │  ChromaDB vector  │
                        │                │      store        │
                        │                └────────┬─────────┘
      question ────────▶│                         │ similarity search
                        │◀────────────────────────┘
                        ▼
                 ┌─────────────┐        ┌──────────────┐
                 │   Ollama    │◀──────▶│  LLM + embed  │
                 │  (llama3.2) │        │    models     │
                 └──────┬──────┘        └──────────────┘
                        │ streamed tokens + sources
                        ▼
                 ┌─────────────┐
                 │  React UI   │  (chat, documents, dark mode)
                 └─────────────┘
```

## Tech Stack

| Layer      | Technology                                                             |
| ---------- | ---------------------------------------------------------------------- |
| Backend    | FastAPI, Uvicorn, SQLModel / SQLAlchemy                                |
| Retrieval  | ChromaDB, LangChain (`langchain-chroma`, `langchain-text-splitters`)   |
| Parsing    | `langchain-opendataloader-pdf`                                         |
| Models     | Ollama (`llama3.2` for generation, `nomic-embed-text` for embeddings)  |
| Persistence| SQLite (chat history), Chroma persistent directory                     |
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS, react-markdown               |

## Prerequisites

- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com) installed and running locally, with the required models pulled:

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

## Setup

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # if present, otherwise create .env (see below)
uvicorn app.main:app --reload
```

The API is served at `http://localhost:8000`.

### Frontend

```bash
cd ui
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` (stripping the `/api` prefix), so open the URL Vite prints (typically `http://localhost:5173`).

## Configuration

Settings are loaded from environment variables / a `.env` file via `app/config.py`.

| Variable                | Default                  | Description                                  |
| ----------------------- | ------------------------ | -------------------------------------------- |
| `PDF_PATH`              | `data/riscv.pdf`         | Default document seeded on first ingestion    |
| `CHROMA_DB_PATH`        | `data/riscv_vector_db`   | ChromaDB persistence directory                |
| `SQLITE_PATH`           | `data/chat.db`           | SQLite database for chats and documents       |
| `DOCUMENTS_DIR`         | `data/documents`         | Directory for uploaded PDFs                   |
| `EMBED_MODEL`           | `nomic-embed-text`       | Ollama embedding model                        |
| `LLM_MODEL`             | `llama3.2`               | Ollama generation model                       |
| `CHUNK_SIZE`            | `1500`                   | Max characters per chunk                      |
| `CHUNK_OVERLAP`         | `200`                    | Overlap between chunks                        |
| `K_RETRIEVAL`           | `3`                      | Number of chunks retrieved per query          |
| `MAX_HISTORY_EXCHANGES` | `10`                     | Prior exchanges included as context           |

## API

| Method   | Endpoint                        | Description                              |
| -------- | ------------------------------- | ---------------------------------------- |
| `GET`    | `/health`                       | Ollama / Chroma / database status        |
| `POST`   | `/ingest`                       | Ingest the default PDF if not yet indexed|
| `POST`   | `/chats`                        | Create a chat (optionally with documents)|
| `GET`    | `/chats`                        | List chats                               |
| `GET`    | `/chats/{chat_id}`              | Get a chat with its messages             |
| `DELETE` | `/chats/{chat_id}`              | Delete a chat                            |
| `GET`    | `/chats/{chat_id}/documents`    | List documents attached to a chat        |
| `PUT`    | `/chats/{chat_id}/documents`    | Set the documents attached to a chat     |
| `POST`   | `/ask`                          | Ask a question (supports `stream: true`) |
| `GET`    | `/documents`                    | List documents                           |
| `POST`   | `/documents/upload`             | Upload and index a PDF                   |
| `PATCH`  | `/documents/{doc_id}`           | Rename a document                        |
| `GET`    | `/documents/{doc_id}/download`  | Download a document                      |
| `DELETE` | `/documents/{doc_id}`           | Delete a document and de-index it        |

## Project Structure

```
rag-risc-v/
├── app/
│   ├── main.py         # FastAPI app, chat/ask endpoints
│   ├── documents.py    # Document CRUD + upload router
│   ├── ingestion.py    # PDF parsing, chunking, embeddings, indexing
│   ├── query.py        # Context building and LLM querying
│   ├── models.py       # SQLModel tables
│   ├── database.py     # Engine and session helpers
│   └── config.py       # Settings
├── ui/
│   └── src/
│       ├── components/ # Chat, sidebar, documents, input
│       └── lib/api.ts  # API client incl. SSE streaming
├── data/               # PDF, vector store, SQLite, uploads (gitignored)
└── requirements.txt
```

## License

No license specified.
