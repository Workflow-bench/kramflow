"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";

// Client-side QR generation (qrcode's toDataURL) — no server round trip
// needed, the link URL is already public information once generated.
export function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#08090c", light: "#f3f5f9" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className="rounded-control bg-raised animate-pulse"
        style={{ width: size, height: size }}
        aria-label="Generating QR code"
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URI, not an optimizable remote/static asset */}
      <img src={dataUrl} alt="QR code for the display share link" width={size} height={size} className="rounded-control" />
      <a
        href={dataUrl}
        download="kramflow-display-link.png"
        className="inline-flex items-center gap-1.5 text-console-meta text-muted hover:text-primary transition-colors"
      >
        <Download className="h-3.5 w-3.5" strokeWidth={2} />
        Download
      </a>
    </div>
  );
}
