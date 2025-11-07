import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { nextUrl, cookies } = req;

  // Only consider root path; allow explicit home override with ?home=1
  if (nextUrl.pathname === "/") {
    const homeOverride = nextUrl.searchParams.get("home") === "1";
    if (!homeOverride) {
      const last = cookies.get("last_location_id")?.value;
      if (last) {
        const url = new URL(`/location/${encodeURIComponent(last)}`, req.url);
        // Use 307/308 to preserve method; 307 is fine here
        return NextResponse.redirect(url, 307);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
