"use client";

import React from "react";
import { useState } from "react";
import { ethers } from "ethers";

export default function AdminPage() {
  const [address, setAddress] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  async function login() {
    try {
      // get nonce
      const nonceRes = await fetch("/api/admin/nonce", { method: "POST" });
      const { nonce } = await nonceRes.json();

      // sign nonce with injected wallet
      // prefer window.ethereum if available
      // fallback to ethers BrowserProvider if present

      const anyWindow = window as any;
      if (!anyWindow.ethereum) {
        setStatus("No wallet found");
        return;
      }
      const provider = new ethers.BrowserProvider(anyWindow.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const signature = await signer.signMessage(nonce);
      setAddress(userAddress);

      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: userAddress, nonce, signature }),
      });
      const data = await res.json();
      if (data.ok && data.token) {
        setToken(data.token);
        try {
          sessionStorage.setItem("adminSessionToken", data.token as string);
        } catch {}
        setStatus("Logged in as " + userAddress);
      } else {
        setStatus("Login failed: " + data.error);
      }
    } catch {
      setStatus("Login error");
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Admin Notifications</h1>
      <div className="space-y-2">
        <button className="btn btn-primary" onClick={login}>
          Login with Wallet
        </button>
        <div>Address: {address}</div>
        <div>Session: {token ? "active" : "none"}</div>
        <div className="text-sm text-gray-500">Set ADMIN_ADDRESSES env to allow your address</div>
      </div>
      <div className="divider" />
      <a
        className="btn"
        href="/admin/notify"
        aria-disabled={!token}
        onClick={e => {
          if (!token) e.preventDefault();
        }}
      >
        Go to Notification Console
      </a>
      <div className="divider" />
      <pre className="text-xs whitespace-pre-wrap break-words">{status}</pre>
    </div>
  );
}
