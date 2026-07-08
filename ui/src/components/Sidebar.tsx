import { Plus, Trash2 } from "lucide-react";
import type { Chat } from "../types";
import { Button } from "./ui/button";

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
    </div>
  );
}
