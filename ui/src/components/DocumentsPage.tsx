import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Pencil, Check, X, FileText, Download, AlertCircle, Loader2 } from "lucide-react";
import type { Doc } from "../types";
import * as api from "../lib/api";

type UploadStatus = "idle" | "uploading" | "success";

export function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.listDocuments().then(setDocs).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    return () => clearTimeout(successTimer.current);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    clearTimeout(successTimer.current);
    setUploadStatus("uploading");

    try {
      await api.uploadDocument(file);
      setUploadStatus("success");
      load();

      successTimer.current = setTimeout(() => {
        setUploadStatus((s) => (s === "success" ? "idle" : s));
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      setUploadStatus("idle");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRename = async (id: string) => {
    if (!editValue.trim()) {
      setEditingId(null);
      return;
    }
    setError(null);
    try {
      await api.renameDocument(id, editValue.trim());
      setEditingId(null);
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rename failed";
      setError(message);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await api.deleteDocument(id);
      setConfirmDelete(null);
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-w-0">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground mb-3">Documents</h1>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            className="hidden"
            id="pdf-upload"
          />
          <label
            htmlFor={uploadStatus === "idle" || uploadStatus === "success" ? "pdf-upload" : undefined}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 cursor-pointer transition-colors disabled:opacity-50"
            style={uploadStatus === "idle" || uploadStatus === "success" ? {} : { pointerEvents: "none", opacity: 0.5 }}
          >
            {uploadStatus === "uploading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadStatus === "uploading" ? "Uploading..." : "Upload PDF"}
          </label>
          <span className="text-xs text-muted-foreground">
            Only PDF files are supported
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-6 py-3 bg-destructive/10 border-b border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-destructive/70 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {uploadStatus === "success" && (
        <div className="flex items-center gap-2 px-6 py-3 bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800">
          <Check className="h-4 w-4 text-green-500 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300 flex-1">Document added</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : docs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-muted mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:border-muted-foreground/20 transition-colors"
              >
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />

                <div className="flex-1 min-w-0">
                  {editingId === doc.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(doc.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 text-sm border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(doc.id)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-foreground truncate">
                        {doc.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {doc.filename} &middot; {doc.chunk_count} chunks
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => api.downloadDocument(doc.id)}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(doc.id);
                      setEditValue(doc.title);
                    }}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {confirmDelete === doc.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(doc.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
