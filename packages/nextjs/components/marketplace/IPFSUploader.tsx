"use client";

import { useEffect, useState } from "react";

export const IPFSUploader = ({
  onSelected,
  autoUpload,
  onUploaded,
}: {
  onSelected?: (file: File | null) => void;
  autoUpload?: boolean;
  onUploaded?: (cid: string) => void;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const maybeUpload = async () => {
      if (!autoUpload) return;
      if (!file) return;
      if (!onUploaded) return;
      setLoading(true);
      try {
        const { uploadFile } = await import("~~/services/ipfs/upload");
        const cid = await uploadFile(file);
        if (!cancelled) onUploaded(cid);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void maybeUpload();
    return () => {
      cancelled = true;
    };
  }, [autoUpload, file, onUploaded]);

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="file-input file-input-bordered w-full"
        onChange={e => {
          const f = e.target.files?.[0] || null;
          if (f && !(f.type || "").startsWith("image/")) {
            setError("Only image files are allowed");
            setFile(null);
            onSelected?.(null);
            return;
          }
          setError(null);
          setFile(f);
          onSelected?.(f);
        }}
      />
      {error && <div className="text-sm text-error">{error}</div>}
      {loading ? <div className="text-sm">Uploading…</div> : null}
    </div>
  );
};
