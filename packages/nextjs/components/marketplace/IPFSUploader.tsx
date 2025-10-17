"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";

export const IPFSUploader = ({
  onSelected,
  autoUpload,
  onUploaded,
}: {
  onSelected?: (file: File | null) => void;
  autoUpload?: boolean;
  onUploaded?: (cid: string) => void;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  // Source image state for interactive cropping
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const cropRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Desired output dimensions for the cropped image (3:2)
  const DEST_W = 1200;
  const DEST_H = 800;

  // Absolute zoom scales relative to the image's natural size
  // containZoom: entire image fits within the crop (furthest edges touch)
  // coverZoom: crop fully filled by the image (closest edges touch)
  const [coverZoom, setCoverZoom] = useState<number>(1);

  const zoomBounds = useMemo(() => {
    const min = 0.75; // normalized contain
    // Give headroom above cover to overcome rounding/clamping and allow precise edge contact
    const max = Math.max(coverZoom * 3, min + 0.01);
    return { min, max };
  }, [coverZoom]);

  // container width not needed with react-easy-crop

  const applyCrop = async () => {
    if (!previewUrl || !imgDims || !sourceFile) return;
    const img = await new Promise<HTMLImageElement>(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.src = previewUrl;
    });
    const area = croppedAreaPixels || {
      x: 0,
      y: 0,
      width: Math.min(imgDims.w, DEST_W),
      height: Math.min(imgDims.h, DEST_H),
    };
    const sx = area.x;
    const sy = area.y;
    const sWidth = area.width;
    const sHeight = area.height;
    const dx = 0;
    const dy = 0;
    const dWidth = DEST_W;
    const dHeight = DEST_H;

    const canvas = document.createElement("canvas");
    canvas.width = DEST_W;
    canvas.height = DEST_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Fill black background for areas without image
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, DEST_W, DEST_H);
    if (sWidth > 0 && sHeight > 0 && dWidth > 0 && dHeight > 0) {
      ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
    }

    const blob: Blob = await new Promise(resolve => {
      canvas.toBlob(b => resolve((b as Blob) || new Blob()), "image/jpeg", 0.92);
    });
    const cropped = new File([blob], sourceFile.name.replace(/\.(png|jpg|jpeg|webp)$/i, "") + "_3x2.jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    setFile(cropped);
    onSelected?.(cropped);
    setCropOpen(false);
  };

  useEffect(() => {
    let cancelled = false;
    const maybeUpload = async () => {
      if (!autoUpload) return;
      if (!file) return;
      if (!onUploaded) return;
      setLoading(true);
      try {
        const { uploadFile } = await import("~~/services/ipfs/upload");
        const cid = await uploadFile(file);
        if (!cancelled) onUploaded(cid);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void maybeUpload();
    return () => {
      cancelled = true;
    };
  }, [autoUpload, file, onUploaded]);

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="file-input file-input-bordered w-full"
        onChange={e => {
          const f = e.target.files?.[0] || null;
          (async () => {
            if (f && !(f.type || "").startsWith("image/")) {
              setError("Only image files are allowed");
              setFile(null);
              setSourceFile(null);
              setPreviewUrl(null);
              onSelected?.(null);
              return;
            }
            if (!f) {
              setError(null);
              setFile(null);
              setSourceFile(null);
              setPreviewUrl(null);
              onSelected?.(null);
              return;
            }
            try {
              setError(null);
              setLoading(true);
              const url = URL.createObjectURL(f);
              setPreviewUrl(url);
              setSourceFile(f);
              const img = await new Promise<HTMLImageElement>(resolve => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.src = url;
              });
              const w = img.naturalWidth || img.width;
              const h = img.naturalHeight || img.height;
              setImgDims({ w, h });
              // Default zoom will be set on media load using the actual container size
              setCrop({ x: 0, y: 0 });
              setCropOpen(true);
            } catch {
              setError("Failed to load image");
              setFile(null);
              setSourceFile(null);
              setPreviewUrl(null);
              onSelected?.(null);
            } finally {
              setLoading(false);
            }
          })();
        }}
      />
      {error && <div className="text-sm text-error">{error}</div>}
      {loading ? <div className="text-sm">Processing…</div> : null}
      {cropOpen && previewUrl && imgDims ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setCropOpen(false)}
        >
          <div
            className="bg-base-100 rounded-lg shadow-xl w-[95vw] sm:w-[85vw] lg:w-2/3 max-w-5xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-medium">Adjust image (3:2)</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCropOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div
                ref={cropRef}
                className="w-full bg-base-300 rounded"
                style={{ aspectRatio: "3 / 2", overflow: "hidden", position: "relative" }}
              >
                <Cropper
                  image={previewUrl}
                  aspect={3 / 2}
                  crop={crop}
                  zoom={zoom}
                  minZoom={zoomBounds.min}
                  maxZoom={zoomBounds.max}
                  zoomWithScroll
                  restrictPosition={false}
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_: Area, areaPixels: Area) => setCroppedAreaPixels(areaPixels)}
                  onMediaLoaded={({ naturalWidth, naturalHeight }) => {
                    const rect = cropRef.current?.getBoundingClientRect();
                    if (rect && naturalWidth && naturalHeight) {
                      // Compute absolute scales relative to natural size. Account for 3:2 crop area.
                      const containerW = rect.width;
                      const containerH = rect.height;
                      const containAbs = Math.min(containerW / naturalWidth, containerH / naturalHeight);
                      const coverAbs = Math.max(containerW / naturalWidth, containerH / naturalHeight);
                      const coverFactor = coverAbs / containAbs; // normalized units
                      setCoverZoom(coverFactor);
                      // Default view = cover and centered
                      setZoom(coverFactor);
                      // Center programmatically so the nearest edges are symmetric
                      // crop in react-easy-crop is percentage based; {x:0,y:0} is centered
                      // Ensure centered positioning at initial load
                      setCrop({ x: 0, y: 0 });
                    } else {
                      setCoverZoom(1);
                      setZoom(1);
                      setCrop({ x: 0, y: 0 });
                    }
                  }}
                  style={{ containerStyle: { width: "100%", height: "100%" } }}
                />
              </div>
              <input
                type="range"
                min={zoomBounds.min}
                max={zoomBounds.max}
                step={Math.max((zoomBounds.max - zoomBounds.min) / 100, 0.01)}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="range range-sm"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSourceFile(null);
                    setPreviewUrl(null);
                    setImgDims(null);
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                    setCoverZoom(1);
                    onSelected?.(null);
                    setCropOpen(false);
                  }}
                >
                  Choose different
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => applyCrop()}>
                  Use image
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
