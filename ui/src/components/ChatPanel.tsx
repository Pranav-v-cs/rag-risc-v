import { useEffect, useRef } from "react";
import { Message } from "./Message";
import { InputBar } from "./InputBar";
import type { Message as MessageType } from "../types";

interface ChatPanelProps {
  messages: MessageType[];
  streamingContent: string;
  isStreaming: boolean;
  selectedChatId: string | null;
  error: string | null;
  onSend: (text: string) => void;
}

export function ChatPanel({
  messages,
  streamingContent,
  isStreaming,
  selectedChatId,
  error,
  onSend,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (!selectedChatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            RISC-V RAG
          </h2>
          <p className="text-sm text-muted-foreground">
            Select a chat or create a new one
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-w-0">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <p className="text-sm text-muted-foreground text-center pt-8">
              Send a message to start
            </p>
          )}

          {messages.map((msg) => (
            <Message
              key={msg.id}
              role={msg.role}
              content={msg.content}
              sources={msg.sources}
            />
          ))}

          {isStreaming && (
            <Message
              role="assistant"
              content={streamingContent}
              sources={null}
              isStreaming
            />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 mx-4 mb-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {error}
        </div>
      )}
      <InputBar onSend={onSend} disabled={isStreaming} />
    </div>
  );
}
