export interface Chat {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  sources: string | null;
  model: string | null;
  created_at: string;
}

export interface Doc {
  id: string;
  filename: string;
  title: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface StreamEvent {
  type: "start" | "token" | "sources" | "done" | "error";
  token?: string;
  sources?: Record<string, unknown>[];
  detail?: string;
}
