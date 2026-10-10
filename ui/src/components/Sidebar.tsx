import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { Chat, Doc } from "../types";
import { Button } from "./ui/button";
import * as api from "../lib/api";

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({
  chats,
  activeChatId,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [docsOpen, setDocsOpen] = useState(false);

  useEffect(() => {
    api.listDocuments().then(setDocs).catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeChatId) {
      setSelectedDocIds(new Set());
      return;
    }
    api.getChatDocuments(activeChatId).then((chatDocs) => {
      const ids = new Set(chatDocs.map((d) => d.id));
      setSelectedDocIds(ids);
      if (ids.size === 0) setDocsOpen(true);
    }).catch(console.error);
  }, [activeChatId]);

  const toggleDoc = async (docId: string) => {
    if (!activeChatId) return;
    const next = new Set(selectedDocIds);
    if (next.has(docId)) {
      next.delete(docId);
    } else {
      next.add(docId);
    }
    setSelectedDocIds(next);
    try {
      await api.setChatDocuments(activeChatId, Array.from(next));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-64 h-full border-r border-border flex flex-col bg-muted shrink-0">
      <div className="p-3 border-b border-border">
        <Button
          onClick={onNew}
          variant="outline"
          className="w-full gap-2"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {chats.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No chats yet
          </p>
        )}

        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`group flex items-center rounded-md px-3 py-2 text-sm cursor-pointer transition-colors ${
              activeChatId === chat.id
                ? "bg-accent text-accent-foreground"
                : "text-foreground hover:bg-accent"
            }`}
            onClick={() => onSelect(chat.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">
                {chat.title || "Untitled"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {chat.message_count} messages
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chat.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-all"
              title="Delete chat"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      {activeChatId && (
        <div className="border-t border-border">
          <button
            onClick={() => setDocsOpen(!docsOpen)}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {docsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Documents
            {selectedDocIds.size > 0 && (
              <span className="ml-auto text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {selectedDocIds.size}
              </span>
            )}
          </button>

          {docsOpen && (
            <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
              {docs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  No documents uploaded
                </p>
              )}
              {docs.map((doc) => {
                const isSelected = selectedDocIds.has(doc.id);
                return (
                  <label
                    key={doc.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDoc(doc.id)}
                      className="rounded border-border accent-primary h-3.5 w-3.5"
                    />
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{doc.title}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
