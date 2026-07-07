import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Pencil, Check, X, FileText } from "lucide-react";
import type { Doc } from "../types";
import * as api from "../lib/api";

export function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.listDocuments().then(setDocs).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadDocument(file);
      load();
    } catch (err) {
      console.error(err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRename = async (id: string) => {
    if (!editValue.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await api.renameDocument(id, editValue.trim());
      setEditingId(null);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDocument(id);
      setConfirmDelete(null);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0">
      <div className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900 mb-3">Documents</h1>
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
            htmlFor="pdf-upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload PDF"}
          </label>
          <span className="text-xs text-gray-400">
            Only PDF files are supported
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
        ) : docs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:border-gray-300 transition-colors"
              >
                <FileText className="h-5 w-5 text-gray-400 shrink-0" />

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
                        className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(doc.id)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-600"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {doc.title}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {doc.filename} &middot; {doc.chunk_count} chunks
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditingId(doc.id);
                      setEditValue(doc.title);
                    }}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {confirmDelete === doc.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(doc.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
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
