"use client";

import { useState } from "react";
import { uploadFile } from "~~/services/ipfs/upload";

export const IPFSUploader = ({
  onUploaded,
  onSelected,
}: {
  onUploaded: (cid: string) => void;
  onSelected?: (file: File | null) => void;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const cid = await uploadFile(file);
      onUploaded(cid);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/*"
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
      <button className="btn" disabled={!file || loading} onClick={upload}>
        {loading ? "Uploading..." : "Upload to IPFS"}
      </button>
    </div>
  );
};
