import { NextResponse } from "next/server";

const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;
const LOCATIONIQ_BASE = process.env.LOCATIONIQ_BASE_URL || "https://us1.locationiq.com";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = searchParams.get("limit") || "50";
    if (!q) return NextResponse.json({ results: [] });
    if (!LOCATIONIQ_API_KEY) return NextResponse.json({ error: "missing api key" }, { status: 500 });

    const url = `${LOCATIONIQ_BASE}/v1/search?format=json&key=${encodeURIComponent(
      LOCATIONIQ_API_KEY,
    )}&q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}&normalizeaddress=1&namedetails=1&extratags=1`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || "locationiq error" }, { status: 500 });
    }
    const json = (await res.json()) as any[];
    // Filter to administrative boundaries (relations) and sort by importance
    const filtered = Array.isArray(json)
      ? json.filter(
          item => item?.class === "boundary" && item?.type === "administrative" && item?.osm_type === "relation",
        )
      : [];
    const top = filtered
      .slice()
      .sort((a, b) => Number(b?.importance || 0) - Number(a?.importance || 0))
      .slice(0, 5);
    // Normalize to the fields our UI expects, and populate akas from namedetails and display_name
    const results = top.map(item => {
      const akas: string[] = [];
      const seen = new Set<string>();
      const add = (s?: string) => {
        const v = (s || "").trim();
        if (!v) return;
        const key = v.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        akas.push(v);
      };
      add(item?.namedetails?.name as string | undefined);
      add((item?.namedetails && (item.namedetails["name:en"] as string)) || undefined);
      add((item.display_name || item.displayplace || item.name) as string | undefined);

      return {
        display_name: item.display_name || item.displayplace || item.name || "",
        lat: item.lat,
        lon: item.lon,
        akas,
      };
    });
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
