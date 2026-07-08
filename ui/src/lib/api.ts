import type { Chat, Doc, Message, StreamEvent } from "../types";

const BASE = "/api";

export async function listChats(): Promise<Chat[]> {
  const res = await fetch(`${BASE}/chats`);
  if (!res.ok) throw new Error("Failed to load chats");
  return res.json();
}

export async function getChat(
  chatId: string
): Promise<{ chat: Chat; messages: Message[] }> {
  const res = await fetch(`${BASE}/chats/${chatId}`);
  if (!res.ok) throw new Error("Failed to load chat");
  return res.json();
}

export async function createChat(title?: string): Promise<Chat> {
  const res = await fetch(`${BASE}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title || "" }),
  });
  if (!res.ok) throw new Error("Failed to create chat");
  return res.json();
}

export async function deleteChat(chatId: string): Promise<void> {
  const res = await fetch(`${BASE}/chats/${chatId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete chat");
}

export async function listDocuments(): Promise<Doc[]> {
  const res = await fetch(`${BASE}/documents`);
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json();
}

export async function uploadDocument(
  file: File,
  title?: string
): Promise<Doc> {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  const res = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    let message = "Upload failed";
    try {
      const json = JSON.parse(text);
      message = json.detail || message;
    } catch {
      message = text || message;
    }
    throw new Error(message);
  }
  return res.json();
}

export async function renameDocument(
  id: string,
  title: string
): Promise<Doc> {
  const res = await fetch(`${BASE}/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to rename document");
  return res.json();
}

export async function downloadDocument(id: string): Promise<void> {
  const res = await fetch(`${BASE}/documents/${id}/download`);
  if (!res.ok) throw new Error("Failed to download document");
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition");
  const match = disposition?.match(/filename="?(.+?)"?$/);
  const filename = match?.[1] ?? "document.pdf";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${BASE}/documents/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

export async function askStream(
  query: string,
  chatId: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, chat_id: chatId, stream: true }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    onEvent({ type: "error", detail: text });
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onEvent({ type: "error", detail: "No response body" });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6)) as StreamEvent;
          onEvent(event);
        } catch {
          /* skip malformed events */
        }
      }
    }
  }
}
