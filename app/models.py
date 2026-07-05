from datetime import datetime, timezone
import uuid

from sqlmodel import Field, SQLModel


class Chat(SQLModel, table=True):
    id: str = Field(
        primary_key=True, default_factory=lambda: str(uuid.uuid4())
    )
    title: str = ""
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class Message(SQLModel, table=True):
    id: str = Field(
        primary_key=True, default_factory=lambda: str(uuid.uuid4())
    )
    chat_id: str = Field(foreign_key="chat.id")
    role: str
    content: str
    sources: str | None = None
    model: str | None = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
