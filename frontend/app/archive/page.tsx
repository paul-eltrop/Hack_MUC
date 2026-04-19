// Archive page: knowledge upload point for the RAG pipeline.
// Files go through Docling → Qdrant; agent finds them via rag_search.
// Gallery clusters documents by user-tagged category, delete removes from RAG.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:8000";

type ArchiveDocument = {
  doc_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string | null;
  category: string;
  text_excerpt: string | null;
  created_at: string;
};

type Category = { id: string; label: string; description: string };

const CATEGORIES: Category[] = [
  { id: "8d-report", label: "8D Reports", description: "Closed 8D cases, lessons learned" },
  { id: "fmea", label: "FMEA", description: "Failure mode and effects analyses" },
  { id: "lieferant", label: "Suppliers", description: "Datasheets, audits, spec sheets" },
  { id: "werk", label: "Factory Docs", description: "Layouts, process descriptions, SOPs" },
  { id: "spezifikation", label: "Specifications", description: "Components, tolerances, test specs" },
  { id: "sonstiges", label: "Other", description: "Anything else worth knowing" },
];

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".xlsx", ".md", ".txt", ".html", ".htm", ".csv"];

type FileTypeStyle = { label: string; bg: string; text: string };

function fileTypeStyle(fileName: string): FileTypeStyle {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  switch (ext) {
    case "pdf":
      return { label: "PDF", bg: "bg-red-50", text: "text-red-600" };
    case "xlsx":
    case "csv":
      return { label: ext.toUpperCase(), bg: "bg-emerald-50", text: "text-emerald-600" };
    case "docx":
      return { label: "DOC", bg: "bg-blue-50", text: "text-blue-600" };
    case "pptx":
      return { label: "PPT", bg: "bg-amber-50", text: "text-amber-700" };
    case "md":
    case "txt":
      return { label: ext.toUpperCase(), bg: "bg-gray-100", text: "text-gray-500" };
    case "html":
    case "htm":
      return { label: "HTML", bg: "bg-purple-50", text: "text-purple-600" };
    default:
      return { label: "FILE", bg: "bg-gray-100", text: "text-gray-500" };
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

async function fetchDocuments(): Promise<ArchiveDocument[]> {
  const res = await fetch(`${PORTAL_URL}/archive/documents`, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json();
}

async function uploadDocument(file: File, category: string): Promise<ArchiveDocument> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("category", category);
  const res = await fetch(`${PORTAL_URL}/archive/upload`, { method: "POST", body: fd });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = typeof data.detail === "string" ? data.detail : data?.detail?.message || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return res.json();
}

async function deleteDocument(docId: string): Promise<void> {
  const res = await fetch(`${PORTAL_URL}/archive/documents/${docId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
}

type Filter = "All" | string;

export default function Archive() {
  const [documents, setDocuments] = useState<ArchiveDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0].id);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const grouped = useMemo(() => {
    const map = new Map<string, ArchiveDocument[]>();
    CATEGORIES.forEach((c) => map.set(c.id, []));
    documents.forEach((d) => {
      const list = map.get(d.category);
      if (list) list.push(d);
      else map.set(d.category, [d]);
    });
    return CATEGORIES.map((c) => ({ ...c, items: map.get(c.id) || [] })).filter((g) => g.items.length > 0);
  }, [documents]);

  const visibleGroups = useMemo(() => {
    if (filter === "All") return grouped;
    return grouped.filter((g) => g.id === filter);
  }, [grouped, filter]);

  const totalCount = documents.length;
  const categoriesUsed = grouped.length;
  const indexedToday = useMemo(() => {
    const today = new Date().toDateString();
    return documents.filter((d) => {
      const created = new Date(d.created_at.includes("T") ? d.created_at : d.created_at.replace(" ", "T") + "Z");
      return created.toDateString() === today;
    }).length;
  }, [documents]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(selectedFile, selectedCategory);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadDocuments();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.doc_id !== docId));
      setPendingDeleteId(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  return (
    <div className="min-h-screen bg-white animate-slide-up">
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="pt-12 pb-8">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
            Manex · Quality Co-Pilot
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-gray-950 leading-tight">Archive</h1>
          <p className="text-sm text-gray-500 mt-3 max-w-2xl">
            Upload 8D reports, FMEA documents, supplier datasheets and factory docs. The Co-Pilot agent
            searches them automatically via RAG.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-px bg-gray-100 rounded-2xl overflow-hidden mb-10">
          <div className="bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Documents</p>
            <p className="text-2xl font-bold text-gray-950">{totalCount}</p>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Categories</p>
            <p className="text-2xl font-bold text-gray-950">{categoriesUsed}</p>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Indexed today</p>
            <p className="text-2xl font-bold text-gray-950">{indexedToday}</p>
          </div>
        </div>

        <section className="border border-gray-100 rounded-2xl p-6 mb-10">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-4">Upload</p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-2xl px-6 py-10 text-center cursor-pointer transition-colors ${
              dragActive ? "border-gray-400 bg-gray-50" : "border-gray-200 bg-gray-50/50 hover:bg-gray-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileTypeBadge fileName={selectedFile.name} />
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-950">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400">{formatSize(selectedFile.size)}</p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-700">
                  Drop a file here or <span className="text-gray-950 font-semibold underline">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF · DOCX · PPTX · XLSX · MD · TXT · HTML · CSV — up to 30 MB</p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mt-4 items-end">
            <div>
              <label className="block text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-1.5">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-950 focus:outline-none focus:border-gray-400 transition-colors"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} — {c.description}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="px-6 py-2.5 bg-gray-950 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? "Processing…" : "Upload"}
            </button>
          </div>

          {uploadError && (
            <div className="mt-4 px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">{uploadError}</div>
          )}
          {uploading && (
            <p className="text-xs text-gray-400 mt-3">
              Parsing document and indexing into RAG. First upload may take 30-60 seconds (model cold start).
            </p>
          )}
        </section>

        {grouped.length > 0 && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            <button
              onClick={() => setFilter("All")}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                filter === "All" ? "bg-gray-950 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              All ({totalCount})
            </button>
            {grouped.map((g) => (
              <button
                key={g.id}
                onClick={() => setFilter(g.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                  filter === g.id ? "bg-gray-950 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {g.label} ({g.items.length})
              </button>
            ))}
          </div>
        )}

        {loading && <p className="text-sm text-gray-400 text-center py-10">Loading archive…</p>}
        {loadError && (
          <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">
            Could not reach portal ({loadError}). Is{" "}
            <code className="bg-red-100 px-1.5 py-0.5 rounded text-[12px]">uvicorn portal.main:app --port 8000</code> running?
          </div>
        )}

        {!loading && !loadError && documents.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400">No documents yet — upload one above to get started.</p>
          </div>
        )}

        <div className="space-y-12">
          {visibleGroups.map((group) => (
            <section key={group.id}>
              <div className="flex items-baseline gap-3 mb-4">
                <h2 className="text-lg font-bold text-gray-950">{group.label}</h2>
                <span className="text-xs text-gray-400">{group.items.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.items.map((doc) => (
                  <DocumentCard
                    key={doc.doc_id}
                    document={doc}
                    isPendingDelete={pendingDeleteId === doc.doc_id}
                    onRequestDelete={() => setPendingDeleteId(doc.doc_id)}
                    onCancelDelete={() => setPendingDeleteId(null)}
                    onConfirmDelete={() => handleDelete(doc.doc_id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function FileTypeBadge({ fileName }: { fileName: string }) {
  const style = fileTypeStyle(fileName);
  return (
    <div
      className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-[10px] tracking-wider ${style.bg} ${style.text}`}
    >
      {style.label}
    </div>
  );
}

type DocumentCardProps = {
  document: ArchiveDocument;
  isPendingDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
};

function DocumentCard({ document: doc, isPendingDelete, onRequestDelete, onCancelDelete, onConfirmDelete }: DocumentCardProps) {
  return (
    <div className="border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition-colors group">
      <div className="flex items-start gap-3">
        <FileTypeBadge fileName={doc.file_name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-950 truncate" title={doc.file_name}>
            {doc.file_name}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {formatSize(doc.file_size_bytes)} · {formatDate(doc.created_at)}
          </p>
          {doc.text_excerpt && (
            <p className="text-xs text-gray-500 mt-2 leading-snug line-clamp-2" title={doc.text_excerpt}>
              {doc.text_excerpt}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-end">
        {isPendingDelete ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onCancelDelete}
              className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 px-2 py-1 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirmDelete}
              className="text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-full transition-colors"
            >
              Confirm delete
            </button>
          </div>
        ) : (
          <button
            onClick={onRequestDelete}
            className="text-[11px] font-semibold text-gray-300 group-hover:text-gray-500 hover:!text-red-600 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
