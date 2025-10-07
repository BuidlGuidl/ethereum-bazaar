import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const GEO_KEY = "locations:geo";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const decodedId = decodeURIComponent(id);
    if (!decodedId) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Fetch basic hash
    const loc = (await redis.hgetall<Record<string, string | undefined>>(`location:${decodedId}`)) || null;
    if (!loc) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Attach coordinates from GEO index (source of truth)
    try {
      const pos = (await redis.geopos(GEO_KEY, decodedId)) as any[];
      const coords = Array.isArray(pos?.[0]) ? pos?.[0]?.[0] : null;
      if (coords) {
        loc.lng = String(coords.longitude ?? loc.lng ?? "");
        loc.lat = String(coords.latitude ?? loc.lat ?? "");
      }
    } catch {}

    // Coerce types for convenience
    const parsed: any = { ...loc };
    parsed.lat = loc.lat != null ? parseFloat(String(loc.lat)) : undefined;
    parsed.lng = loc.lng != null ? parseFloat(String(loc.lng)) : undefined;
    parsed.radiusMiles = loc.radiusMiles != null ? parseFloat(String(loc.radiusMiles)) : undefined;
    if (loc.akas) {
      try {
        parsed.akas = JSON.parse(String(loc.akas));
      } catch {
        parsed.akas = String(loc.akas);
      }
    }

    return NextResponse.json({ location: parsed });
  } catch (e: any) {
    if (String(e?.message || "").includes("Unexpected non-whitespace character after JSON")) {
      return NextResponse.json({ error: "Temporary Redis JSON parse issue" }, { status: 502 });
    }
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
