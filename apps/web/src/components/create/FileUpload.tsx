"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { uploadSource } from "@/src/lib/api";
import { cn } from "@/src/lib/cn";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.txt,application/pdf,text/plain";

interface FileUploadProps {
  /** Called with the extracted sourceText (or undefined when cleared). */
  onChange: (sourceText: string | undefined) => void;
}

type Status = "idle" | "uploading" | "done" | "error";

export function FileUpload({ onChange }: FileUploadProps): React.ReactNode {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File): Promise<void> {
    setError(null);
    const okType =
      file.type === "application/pdf" ||
      file.type === "text/plain" ||
      /\.(pdf|txt)$/i.test(file.name);
    if (!okType) {
      setStatus("error");
      setError("Only PDF or .txt files are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus("error");
      setError("File is larger than 10MB.");
      return;
    }
    setFileName(file.name);
    setStatus("uploading");
    try {
      const { sourceText } = await uploadSource(file);
      onChange(sourceText);
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Upload failed. Please try again.");
      onChange(undefined);
    }
  }

  function clear(): void {
    setStatus("idle");
    setFileName(null);
    setError(null);
    onChange(undefined);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (status === "done" || status === "uploading") {
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-neutral-50 p-4 ring-1 ring-black/[0.06]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-black/5">
          <FileText className="size-5 text-ink" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{fileName}</p>
          <p className="text-xs text-muted">
            {status === "uploading" ? "Extracting text…" : "Text extracted, used to ground generation"}
          </p>
        </div>
        {status === "uploading" ? (
          <Loader2 className="size-5 animate-spin text-faint" />
        ) : (
          <>
            <CheckCircle2 className="size-5 text-status" />
            <button
              type="button"
              onClick={clear}
              aria-label="Remove file"
              className="flex size-8 items-center justify-center rounded-full text-faint transition hover:bg-neutral-200 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition",
          dragging ? "border-brand-400 bg-brand-50" : "border-neutral-300 bg-neutral-50/60 hover:border-neutral-400",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white ring-1 ring-black/5">
          <UploadCloud className="size-6 text-ink" />
        </span>
        <p className="mt-3 text-[0.95rem] font-semibold text-ink">
          Choose a file or drag &amp; drop it here
        </p>
        <p className="mt-1 text-xs text-faint">PDF or .txt, up to 10MB</p>
        <span className="mt-4 inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold text-ink ring-1 ring-black/[0.08] transition hover:bg-neutral-100">
          Browse Files
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        aria-label="Upload a PDF or text file"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-hard-fg">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-faint">
          Optional: upload source material to ground the questions
        </p>
      )}
    </div>
  );
}
