import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import fs from "fs";

const execFileAsync = promisify(execFile);

function getDlpPath(): string {
  const isMac = process.platform === "darwin";
  const binaryName = isMac ? "yt-dlp" : "yt-dlp-linux";
  const srcPath = path.join(process.cwd(), "bin", binaryName);

  if (isMac) {
    return srcPath;
  }

  const destPath = path.join("/tmp", binaryName);

  if (!fs.existsSync(srcPath)) {
    throw new Error(`yt-dlp binary not found at ${srcPath}`);
  }

  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(srcPath, destPath);
  }

  fs.chmodSync(destPath, 0o755);

  return destPath;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const ytDlpPath = getDlpPath();
    const { stdout } = await execFileAsync(ytDlpPath, [
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      url,
    ], { maxBuffer: 50 * 1024 * 1024 }); // 50MB buffer for large format lists

    const info = JSON.parse(stdout);

    const videoFormats: { id: string; label: string; ext: string; type: string }[] = [];

    // Collect unique heights from ALL formats that have a video stream
    // (YouTube stores 1080p+ as video-only streams — we must NOT exclude them)
    const availableHeights: number[] = Array.from(new Set<number>(
      (info.formats || [])
        .filter((fmt: { height?: number; vcodec?: string; acodec?: string }) => (
          fmt.height &&                 // must have a resolution
          fmt.height >= 360 &&          // skip tiny thumbnails
          fmt.vcodec &&                 // must have a video codec
          fmt.vcodec !== "none"         // exclude audio-only streams
          // NOTE: acodec can be "none" — that is fine, those are the 1080p/4K video-only streams
        ))
        .map((fmt: { height: number }) => fmt.height)
    )).sort((a: number, b: number) => b - a);   // highest first

    const maxHeight = availableHeights[0] || 0;

    // "Best" option always first
    videoFormats.push({
      id: "best",
      label: maxHeight >= 2160 ? "Best Available (4K)" : maxHeight > 0 ? `Best Available (${maxHeight}p)` : "Best Available",
      ext: "mp4",
      type: "video",
    });

    // Add up to 8 individual quality options
    for (const height of availableHeights.slice(0, 8)) {
      const qualityTag = height >= 2160 ? " 🔵 4K" : height >= 1440 ? " 2K" : height >= 1080 ? " FHD" : height >= 720 ? " HD" : "";
      videoFormats.push({
        id: `${height}p`,
        label: `${height}p${qualityTag}`,
        ext: "mp4",
        type: "video",
      });
    }

    // Always add MP3 audio option
    const allFormats = [
      ...videoFormats,
      { id: "mp3", label: "MP3 Audio Only", ext: "mp3", type: "audio" },
    ];

    return NextResponse.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      channel: info.channel || info.uploader,
      formats: allFormats,
    });
  } catch (err: unknown) {
    console.error("yt-dlp error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to fetch video info. Make sure the URL is valid.", details: message },
      { status: 500 }
    );
  }
}
