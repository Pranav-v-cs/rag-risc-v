import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SourceRefProps {
  sources: string;
}

function SourceRef({ sources }: SourceRefProps) {
  let parsed: Record<string, unknown>[] = [];
  try {
    parsed = JSON.parse(sources);
  } catch {
    return null;
  }

  const labels = parsed.map((s) => {
    const chapter = s.Chapter || s.Section || "";
    const section = s.Section || s.Sub_Section || "";
    return [chapter, section].filter(Boolean).join(" › ");
  });

  if (labels.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-border">
      <p className="text-xs text-muted-foreground">
        Sources: {labels.join(", ")}
      </p>
    </div>
  );
}

interface MessageProps {
  role: "user" | "assistant";
  content: string;
  sources: string | null;
  isStreaming?: boolean;
}

export function Message({
  role,
  content,
  sources,
  isStreaming,
}: MessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
          isUser
            ? "bg-muted text-foreground"
            : "bg-background text-foreground border border-border"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="text-sm [&_p]:mb-1 [&_p:last-child]:mb-0 [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_pre]:bg-muted [&_pre]:rounded [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:font-semibold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || ""}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-muted-foreground animate-pulse ml-0.5" />
            )}
          </div>
        )}

        {sources && !isStreaming && <SourceRef sources={sources} />}
      </div>
    </div>
  );
}
