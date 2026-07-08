import { useState, useEffect, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { DocumentsPage } from "./components/DocumentsPage";
import type { Chat, Message } from "./types";
import * as api from "./lib/api";

type View = "chat" | "documents";

export default function App() {
  const [view, setView] = useState<View>("chat");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

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
    <div className="h-screen flex flex-col bg-background text-foreground">
      <div className="flex items-center border-b border-border shrink-0">
        <button
          onClick={() => setView("chat")}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            view === "chat"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setView("documents")}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            view === "documents"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Documents
        </button>

        <div className="ml-auto mr-3">
          <button
            onClick={() => setDark((d) => !d)}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {view === "chat" ? (
          <>
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
          </>
        ) : (
          <DocumentsPage />
        )}
      </div>
    </div>
  );
}
