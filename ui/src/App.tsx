import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import type { Chat, Message } from "./types";
import * as api from "./lib/api";

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    api.listChats().then(setChats).catch(console.error);
  }, []);

  const selectChat = useCallback(async (id: string) => {
    setActiveChatId(id);
    setStreamingContent("");
    try {
      const data = await api.getChat(id);
      setMessages(data.messages);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const createChat = useCallback(async () => {
    try {
      const chat = await api.createChat();
      setChats((prev) => [chat, ...prev]);
      selectChat(chat.id);
    } catch (err) {
      console.error(err);
    }
  }, [selectChat]);

  const deleteChat = useCallback(
    async (id: string) => {
      try {
        await api.deleteChat(id);
        setChats((prev) => prev.filter((c) => c.id !== id));
        if (activeChatId === id) {
          setActiveChatId(null);
          setMessages([]);
        }
      } catch (err) {
        console.error(err);
      }
    },
    [activeChatId]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!activeChatId || isStreaming) return;

      setIsStreaming(true);
      setStreamingContent("");

      const tempId = crypto.randomUUID();
      const userMsg: Message = {
        id: tempId,
        chat_id: activeChatId,
        role: "user",
        content: text,
        sources: null,
        model: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        await api.askStream(text, activeChatId, (event) => {
          switch (event.type) {
            case "token":
              setStreamingContent((prev) => prev + (event.token ?? ""));
              break;
            case "done": {
              setIsStreaming(false);
              setStreamingContent("");
              api.getChat(activeChatId).then((data) => {
                setMessages(data.messages);
              });
              api.listChats().then(setChats).catch(console.error);
              break;
            }
            case "error":
              console.error(event.detail);
              setIsStreaming(false);
              break;
          }
        });
      } catch (err) {
        console.error(err);
        setIsStreaming(false);
      }
    },
    [activeChatId, isStreaming]
  );

  return (
    <div className="h-screen flex bg-white text-gray-900">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelect={selectChat}
        onNew={createChat}
        onDelete={deleteChat}
      />
      <ChatPanel
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        selectedChatId={activeChatId}
        onSend={sendMessage}
      />
    </div>
  );
}
