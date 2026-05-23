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

  // On Vercel / serverless (Linux), copy the binary to /tmp to ensure execution permissions
  const destPath = path.join("/tmp", binaryName);
  if (!fs.existsSync(destPath)) {
    try {
      fs.copyFileSync(srcPath, destPath);
      fs.chmodSync(destPath, 0o755);
    } catch (e) {
      console.error("Failed to copy/chmod yt-dlp Linux binary:", e);
    }
  }
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
      url,
    ]);

    const info = JSON.parse(stdout);

    // Filter for high-quality video+audio formats and video-only formats (for merging)
    const videoFormats: { id: string; label: string; ext: string; type: string }[] = [];

    // Collect best resolutions
    const seenResolutions = new Set<string>();

    if (info.formats) {
      // Sort formats by height descending
      const sorted = [...info.formats].sort(
        (a, b) => (b.height || 0) - (a.height || 0)
      );

      for (const fmt of sorted) {
        if (!fmt.height || fmt.height < 480) continue;
        const label = `${fmt.height}p${fmt.fps && fmt.fps > 30 ? ` ${fmt.fps}fps` : ""}`;
        if (seenResolutions.has(label)) continue;
        seenResolutions.add(label);

        videoFormats.push({
          id: `${fmt.height}p`,
          label,
          ext: "mp4",
          type: "video",
        });

        if (videoFormats.length >= 5) break;
      }
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
