import { NextResponse } from "next/server";

const PINATA_JWT = process.env.PINATA_JWT; // preferred
const PINATA_API_KEY = process.env.PINATA_API_KEY; // optional fallback
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY; // optional fallback
const PINATA_PIN_URL = process.env.PINATA_PIN_URL || "https://api.pinata.cloud/pinning/pinFileToIPFS";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file missing" }, { status: 400 });
    const contentType = (file as any)?.type || "";
    const isJson = contentType.includes("application/json");
    const isImage = contentType.startsWith("image/");
    if (!isJson && !isImage) {
      return NextResponse.json({ error: "Only image or JSON files are allowed" }, { status: 415 });
    }

    // Use Pinata
    const upstream = new FormData();
    // Append file with a filename so Pinata's multer treats it as the single file field
    upstream.append("file", file as any, ((file as any)?.name as string) || "upload");
    // Metadata and options must be JSON strings (not Blobs) per Pinata expectations
    upstream.append("pinataMetadata", JSON.stringify({ name: ((file as any)?.name as string) || "upload" }));
    upstream.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const headers: Record<string, string> = {};
    if (PINATA_JWT) {
      headers["Authorization"] = `Bearer ${PINATA_JWT}`;
    } else if (PINATA_API_KEY && PINATA_SECRET_API_KEY) {
      headers["pinata_api_key"] = PINATA_API_KEY;
      headers["pinata_secret_api_key"] = PINATA_SECRET_API_KEY;
    }
    const res = await fetch(PINATA_PIN_URL, { method: "POST", body: upstream as any, headers });
    const text = await res.text();
    if (res.ok) {
      try {
        const json: any = JSON.parse(text);
        const cid = json.IpfsHash || json.Hash || json.cid || json.Cid || json.cidString;
        if (cid) return NextResponse.json({ cid });
        return NextResponse.json({ error: "Missing CID in Pinata response", details: json }, { status: 502 });
      } catch {
        return NextResponse.json({ error: "Unexpected Pinata response", details: text }, { status: 502 });
      }
    }
    // Non-2xx response
    let details: any = text;
    try {
      details = JSON.parse(text);
    } catch {}
    return NextResponse.json(
      { error: "Pinata pin failed", status: res.status, details },
      { status: res.status >= 400 ? res.status : 502 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "upload failed" }, { status: 500 });
  }
  // Fallback safeguard (should not reach here)
  return NextResponse.json({ error: "Unhandled upload error" }, { status: 500 });
}
