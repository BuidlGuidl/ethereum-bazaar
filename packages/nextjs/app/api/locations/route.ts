import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const GEO_KEY = "locations:geo";

function milesToMeters(miles: number) {
  return miles * 1609.344;
}

function idFor(lat: number, lng: number, miles: number) {
  // stable id based on coords+radius
  return `loc:${lat.toFixed(5)}:${lng.toFixed(5)}:${miles.toFixed(2)}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").toLowerCase();
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const radiusMilesStr = searchParams.get("radiusMiles");
    const limit = parseInt(searchParams.get("limit") || "200");

    // Nearby mode if lat/lng provided
    if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      const radiusMiles = parseFloat(radiusMilesStr || "10");
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
      }
      const meters = milesToMeters(radiusMiles);
      const nearby = await redis.geosearch(
        GEO_KEY,
        { type: "FROMLONLAT", coordinate: { lon: lng, lat } },
        { type: "BYRADIUS", radius: meters, radiusType: "M" },
        "ASC",
        { withCoord: true, count: { limit } },
      );
      const ids = (nearby as { member: string }[]).map(x => x.member);
      const pipeline = redis.pipeline();
      ids.forEach(id => pipeline.hgetall(`location:${id}`));
      const results = (await pipeline.exec()) as unknown[];
      const locations = results.map(r => (Array.isArray(r) ? (r as any)[1] : r));
      return NextResponse.json({ locations });
    }

    // All/search mode: list all members from GEO zset
    const ids = (await redis.zrange<string[]>(GEO_KEY, 0, -1)) as unknown as string[];
    if (!ids?.length) return NextResponse.json({ locations: [] });
    const pipeline = redis.pipeline();
    ids.forEach(id => pipeline.hgetall(`location:${id}`));
    const rows = (await pipeline.exec()) as unknown[];
    let locations = rows.map(r => (Array.isArray(r) ? (r as any)[1] : r)).filter(Boolean) as any[];
    // Attach coordinates
    const geoPipe = redis.pipeline();
    ids.forEach(id => geoPipe.geopos(GEO_KEY, id));
    const geo = (await geoPipe.exec()) as unknown[];
    locations = locations.map((loc: any, i: number) => {
      const entry = Array.isArray(geo[i]) ? (geo[i] as any)[1] : null;
      const coords = Array.isArray(entry) ? entry[0] : null;
      if (coords) {
        loc.lng = String(coords.longitude ?? loc.lng ?? "");
        loc.lat = String(coords.latitude ?? loc.lat ?? "");
      }
      if (loc.akas && typeof loc.akas === "string") {
        try {
          loc.akas = JSON.parse(loc.akas);
        } catch {}
      }
      return loc;
    });
    if (q) {
      locations = locations.filter(loc => {
        const name = (loc.name || "").toLowerCase();
        const id = (loc.id || "").toLowerCase();
        const akas: string[] = Array.isArray(loc.akas) ? loc.akas : [];
        const akaMatch = akas.some(a => (a || "").toLowerCase().includes(q));
        return name.includes(q) || id.includes(q) || akaMatch;
      });
    }
    return NextResponse.json({ locations: locations.slice(0, limit) });
  } catch (e: any) {
    if (String(e?.message || "").includes("Unexpected non-whitespace character after JSON")) {
      return NextResponse.json(
        {
          error:
            "Upstash/Redis response parsing glitch detected. Please retry. If it persists, check Redis configuration or temporarily disable overlap checks.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Be defensive when parsing the body: sometimes clients send extra chars around JSON
    const raw = await req.text();
    let body: any = null;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        // Attempt to salvage JSON object substring if there are stray characters (e.g., "null{...}")
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          try {
            body = JSON.parse(raw.slice(start, end + 1));
          } catch {}
        }
      }
    }
    // Fallback: handle x-www-form-urlencoded bodies
    if (!body && req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
      const form = new URLSearchParams(raw || "");
      body = Object.fromEntries(form.entries());
    }

    const { name } = body || {};
    let { lat, lng, radiusMiles, startsAt, endsAt, temporary, akas, force } = body || {};

    // Coerce primitive types from strings if needed
    if (typeof lat === "string") lat = parseFloat(lat);
    if (typeof lng === "string") lng = parseFloat(lng);
    if (typeof radiusMiles === "string") radiusMiles = parseFloat(radiusMiles);
    if (typeof startsAt === "string" && startsAt) startsAt = parseInt(startsAt);
    if (typeof endsAt === "string" && endsAt) endsAt = parseInt(endsAt);
    if (typeof temporary === "string") temporary = temporary === "true" || temporary === "1";
    if (typeof akas === "string") {
      try {
        akas = JSON.parse(akas);
      } catch {
        akas = akas
          .split(",")
          .map((a: string) => a.trim())
          .filter(Boolean);
      }
    }
    if (typeof force === "string") force = force === "true" || force === "1";
    if (
      typeof name !== "string" ||
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      typeof radiusMiles !== "number"
    ) {
      return NextResponse.json({ error: "name, lat, lng, radiusMiles required" }, { status: 400 });
    }

    const id = idFor(lat, lng, radiusMiles);

    // Overlap check: find existing within this circle unless force is set
    if (!force) {
      try {
        const overlaps = await redis.geosearch(
          GEO_KEY,
          { type: "FROMLONLAT", coordinate: { lon: lng, lat } },
          { type: "BYRADIUS", radius: milesToMeters(radiusMiles), radiusType: "M" },
          "ASC",
          { withCoord: true, count: { limit: 100 } },
        );
        if (overlaps?.length) {
          const pipeline = redis.pipeline();
          overlaps.forEach(x => pipeline.hgetall(`location:${x.member}`));
          const existing = (await pipeline.exec()) as unknown[];
          const list = existing.map(r => (Array.isArray(r) ? (r as any)[1] : r)).filter(Boolean);
          if (list.length > 0) {
            return NextResponse.json({ promptExisting: true, existing: list }, { status: 409 });
          }
          // If GEO entries are stale (no backing hash), allow creation to proceed
        }
      } catch (err: any) {
        console.log("Error checking overlaps", { err });
        // If the Redis client had a JSON parsing hiccup (e.g., "null{" prefix), skip overlap check
        if (String(err?.message || "").includes("Unexpected non-whitespace character after JSON")) {
          // proceed without overlap gating
        } else {
          throw err;
        }
      }
    }

    // Create new (attempt even if overlap check failed due to SDK parse noise)
    try {
      await redis.geoadd(GEO_KEY, { longitude: lng, latitude: lat, member: id });
      const now = Date.now();
      await redis.hset(`location:${id}`, {
        id,
        name,
        lat: String(lat),
        lng: String(lng),
        radiusMiles: String(radiusMiles),
        akas: akas && Array.isArray(akas) ? JSON.stringify(akas) : "",
        temporary: temporary ? "1" : "0",
        startsAt: startsAt ? String(startsAt) : "",
        endsAt: endsAt ? String(endsAt) : "",
        createdAt: String(now),
      });
    } catch (err: any) {
      if (String(err?.message || "").includes("Unexpected non-whitespace character after JSON")) {
        return NextResponse.json(
          {
            error: "Storage error parsing JSON response. Please retry. If persists, check Upstash/Redis configuration.",
          },
          { status: 502 },
        );
      }
      throw err;
    }
    return NextResponse.json({ id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
