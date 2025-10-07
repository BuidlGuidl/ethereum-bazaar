export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/ipfs", { method: "POST", body: form });
  const text = await res.text();
  if (!res.ok) {
    try {
      const err = JSON.parse(text);
      throw new Error(err?.error || "upload failed");
    } catch {
      throw new Error("upload failed");
    }
  }
  try {
    const json = JSON.parse(text);
    if (!json?.cid) throw new Error("upload failed");
    return json.cid as string;
  } catch {
    throw new Error("upload failed");
  }
}

export async function uploadJSON(obj: any): Promise<string> {
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  // @ts-ignore - File available in browser env
  const file = new File([blob], "metadata.json", { type: "application/json" });
  return uploadFile(file);
}
