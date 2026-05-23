"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface VideoFormat {
  id: string;
  label: string;
  ext: string;
  type: "video" | "audio";
}

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  channel: string;
  formats: VideoFormat[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const videoIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const audioIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </svg>
);

const downloadIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const spinner = (
  <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const checkIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setVideoInfo(null);
    setError(null);
  };

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setVideoInfo(null);
    setDoneIds(new Set());
    try {
      const res = await fetch(`/api/video/info?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch video info");
      setVideoInfo(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: VideoFormat) => {
    if (!videoInfo) return;
    setDownloadingId(format.id);

    try {
      const params = new URLSearchParams({
        url: url.trim(),
        format: format.id,
        title: videoInfo.title,
      });

      const res = await fetch(`/api/video/download?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Download failed");
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${videoInfo.title}.${format.ext}`;
      a.click();
      URL.revokeObjectURL(blobUrl);

      setDoneIds((prev) => new Set([...prev, format.id]));
      showToast(`Downloaded as ${format.ext.toUpperCase()}!`, "success");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Download failed", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  const videoFormats = videoInfo?.formats.filter((f) => f.type === "video") || [];
  const audioFormats = videoInfo?.formats.filter((f) => f.type === "audio") || [];

  return (
    <main style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      {/* Background blobs */}
      <div className="bg-blob-1" />
      <div className="bg-blob-2" />
      <div className="bg-blob-3" />

      <div style={{ width: "100%", maxWidth: 680, position: "relative", zIndex: 2 }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: 40 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg, #a855f7, #ec4899)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(168,85,247,0.4)"
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1 0-1.733 1.234 1.234 0 0 1 1.734 0L9.333 4.44a1.234 1.234 0 0 1 0 1.733L6.667 8.867a1.234 1.234 0 0 1-1.734 0 1.234 1.234 0 0 1 0-1.733l1.12-1.08h-.72C4.012 6.125 3.098 6.489 2.4 7.16c-.698.671-1.067 1.551-1.107 2.64v7.092c.04 1.089.41 1.969 1.107 2.64.698.671 1.613 1.022 2.747 1.054h13.36c1.134-.032 2.049-.383 2.747-1.054.698-.671 1.067-1.551 1.107-2.64V9.8c-.04-1.089-.41-1.969-1.107-2.64-.698-.671-1.613-1.035-2.747-1.067h-.854l1.12 1.08a1.234 1.234 0 0 1 0 1.733 1.234 1.234 0 0 1-1.734 0L14.667 6.173a1.234 1.234 0 0 1 0-1.733l2.666-2.667a1.234 1.234 0 0 1 1.734 0 1.234 1.234 0 0 1 0 1.733l-1.254 1.147zM9.5 15.373V9.6a.667.667 0 0 1 1-.578l4.934 2.893a.667.667 0 0 1 0 1.154L10.5 15.96a.667.667 0 0 1-1-.587z"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.5px" }}>
              <span className="gradient-text">YT Downloader</span>
            </h1>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 16, lineHeight: 1.6 }}>
            Download YouTube videos in <strong style={{ color: "#c084fc" }}>1080p, 4K</strong> or save audio as <strong style={{ color: "#f472b6" }}>MP3</strong>.
          </p>
        </motion.div>

        {/* Input Card */}
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ padding: 24, marginBottom: 24 }}
        >
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            YouTube URL
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              ref={inputRef}
              id="youtube-url-input"
              className="url-input"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              disabled={loading}
            />
            <button
              id="fetch-info-btn"
              className="btn-primary"
              onClick={handleFetch}
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {spinner} Fetching...
                </span>
              ) : (
                "Fetch"
              )}
            </button>
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 12, color: "#f87171", fontSize: 14 }}
            >
              ⚠️ {error}
            </motion.p>
          )}
        </motion.div>

        {/* Loading skeleton */}
        <AnimatePresence>
          {loading && (
            <motion.div
              className="glass-card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{ padding: 24 }}
            >
              <div style={{ display: "flex", gap: 20 }}>
                <div className="skeleton" style={{ width: 160, height: 90, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 20, marginBottom: 10 }} />
                  <div className="skeleton" style={{ height: 14, width: "60%" }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Info Card */}
        <AnimatePresence>
          {videoInfo && !loading && (
            <motion.div
              className="glass-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              style={{ padding: 24 }}
            >
              {/* Thumbnail + Meta */}
              <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
                <div className="thumbnail-container" style={{ width: 200, flexShrink: 0 }}>
                  <img src={videoInfo.thumbnail} alt={videoInfo.title} />
                  <div className="thumbnail-overlay" />
                  {videoInfo.duration && (
                    <div style={{
                      position: "absolute", bottom: 8, right: 8,
                      background: "rgba(0,0,0,0.75)", borderRadius: 6,
                      padding: "2px 8px", fontSize: 12, fontWeight: 600, color: "white"
                    }}>
                      {formatDuration(videoInfo.duration)}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{
                    fontSize: 16, fontWeight: 700, lineHeight: 1.4,
                    marginBottom: 8, overflow: "hidden",
                    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical"
                  }}>
                    {videoInfo.title}
                  </h2>
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    {videoInfo.channel}
                  </p>
                </div>
              </div>

              <div className="divider" />

              {/* Video Formats */}
              {videoFormats.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span className="format-badge">{videoIcon} Video</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Select quality to download</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                    {videoFormats.map((fmt) => (
                      <button
                        key={fmt.id}
                        id={`download-${fmt.id}`}
                        className="btn-download"
                        onClick={() => handleDownload(fmt)}
                        disabled={downloadingId !== null}
                      >
                        {downloadingId === fmt.id ? (
                          <>{spinner} Downloading</>
                        ) : doneIds.has(fmt.id) ? (
                          <>{checkIcon} {fmt.label}</>
                        ) : (
                          <>{downloadIcon} {fmt.label}</>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio Format */}
              {audioFormats.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span className="format-badge audio">{audioIcon} Audio</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Download audio only</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {audioFormats.map((fmt) => (
                      <button
                        key={fmt.id}
                        id={`download-${fmt.id}`}
                        className="btn-download audio"
                        onClick={() => handleDownload(fmt)}
                        disabled={downloadingId !== null}
                        style={{ maxWidth: 220 }}
                      >
                        {downloadingId === fmt.id ? (
                          <>{spinner} Converting to MP3...</>
                        ) : doneIds.has(fmt.id) ? (
                          <>{checkIcon} Downloaded MP3</>
                        ) : (
                          <>{downloadIcon} Download MP3</>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Downloading indicator */}
              <AnimatePresence>
                {downloadingId && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    style={{ marginTop: 20, padding: "14px 18px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 12 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div className="pulse-glow">{spinner}</div>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {downloadingId === "mp3" ? "Extracting and converting to MP3…" : `Downloading ${downloadingId} video…`}
                      </span>
                    </div>
                    <div className="progress-bar-track">
                      <motion.div
                        className="progress-bar-fill"
                        initial={{ width: "0%" }}
                        animate={{ width: "90%" }}
                        transition={{ duration: 8, ease: "easeOut" }}
                      />
                    </div>
                    <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                      This may take a moment. The file will download automatically when ready.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ textAlign: "center", marginTop: 28, color: "var(--text-muted)", fontSize: 13 }}
        >
          Powered by <strong style={{ color: "var(--text-primary)" }}>yt-dlp</strong> + <strong style={{ color: "var(--text-primary)" }}>ffmpeg</strong>
        </motion.p>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{ borderColor: toast.type === "success" ? "rgba(168,85,247,0.3)" : "rgba(248,113,113,0.3)" }}
          >
            {toast.type === "success" ? (
              <span style={{ color: "#a855f7" }}>{checkIcon}</span>
            ) : (
              <span style={{ color: "#f87171" }}>⚠️</span>
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
