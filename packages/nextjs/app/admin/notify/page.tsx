"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type StoredEvent = {
  at: number;
  data: {
    header?: unknown;
    payload?: { event?: string; notificationDetails?: { url: string; token: string } };
  };
};

export default function NotifyConsole() {
  const router = useRouter();
  const [token, setToken] = useState<string>("");
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [since, setSince] = useState<string>("");
  const [until, setUntil] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    // Pull token from sessionStorage (set after login)
    const t = sessionStorage.getItem("adminSessionToken") || "";
    if (!t) {
      setToken("");
      router.replace("/admin");
      return;
    }
    setToken(t);
  }, [router]);

  async function loadEvents() {
    if (!token) return;
    const req: { sinceMs?: number; untilMs?: number; type?: string; limit?: number } = { limit: 200 };
    if (since) req.sinceMs = Date.parse(since);
    if (until) req.untilMs = Date.parse(until);
    if (type) req.type = type;
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(req),
    });
    const data = await res.json();
    if (data.ok) setEvents(data.events as StoredEvent[]);
  }

  const fids = useMemo(() => {
    const list: number[] = [];
    for (const ev of events) {
      const fid = (ev.data as any)?.header?.fid as number | undefined;
      if (typeof fid === "number") list.push(fid);
    }
    return Array.from(new Set(list));
  }, [events]);

  async function sendSelected() {
    const chosen = fids.filter(fid => selected[String(fid)]);
    if (!chosen.length) return;
    const results = [] as unknown[];
    for (const fid of chosen) {
      const res = await fetch("/api/admin/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fid, title, body }),
      });
      if (res.status === 401) {
        router.replace("/admin");
        return;
      }
      results.push(await res.json());
    }
    setStatus(JSON.stringify(results));
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Notification Console</h1>
      <div className="space-y-2">
        <div>Session: {token ? "active" : "none"}</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            className="input input-bordered w-full"
            type="datetime-local"
            value={since}
            onChange={e => setSince(e.target.value)}
          />
          <input
            className="input input-bordered w-full"
            type="datetime-local"
            value={until}
            onChange={e => setUntil(e.target.value)}
          />
          <select className="select select-bordered w-full" value={type} onChange={e => setType(e.target.value)}>
            <option value="">Any</option>
            <option value="miniapp_added">miniapp_added</option>
            <option value="miniapp_removed">miniapp_removed</option>
            <option value="notifications_enabled">notifications_enabled</option>
            <option value="notifications_disabled">notifications_disabled</option>
          </select>
          <button className="btn" onClick={loadEvents} disabled={!token}>
            Load Events
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-medium">Select FIDs</h2>
        <div className="flex flex-wrap gap-2">
          {fids.map(fid => (
            <label key={fid} className="cursor-pointer flex items-center gap-2 border rounded px-2 py-1">
              <input
                type="checkbox"
                className="checkbox"
                checked={!!selected[String(fid)]}
                onChange={e => setSelected({ ...selected, [String(fid)]: e.target.checked })}
              />
              <span>{fid}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <input
          className="input input-bordered w-full"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <input
          className="input input-bordered w-full"
          placeholder="Body"
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <button className="btn btn-primary" onClick={sendSelected} disabled={!token || !title || !body}>
          Send Notifications
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="font-medium">Recent Events</h2>
        <div className="max-h-96 overflow-auto border rounded p-2 text-xs">
          {events.map((ev, idx) => (
            <div key={idx} className="border-b py-1">
              <div>
                {new Date(ev.at).toLocaleString()} — {(ev.data as any)?.payload?.event}
              </div>
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(ev.data, null, 2)}</pre>
            </div>
          ))}
        </div>
      </div>

      <pre className="text-xs whitespace-pre-wrap break-words">{status}</pre>
    </div>
  );
}
