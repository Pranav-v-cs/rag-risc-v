import type { Chat, Message, StreamEvent } from "../types";

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
