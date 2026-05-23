import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import ffmpegStatic from "ffmpeg-static";

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

const isMac = process.platform === "darwin";
const TMP_DIR = isMac
  ? path.join(process.cwd(), ".tmp-downloads")
  : os.tmpdir();

// Ensure tmp dir exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const formatId = request.nextUrl.searchParams.get("format");
  const title = request.nextUrl.searchParams.get("title") || "download";

  if (!url || !formatId) {
    return NextResponse.json({ error: "url and format are required" }, { status: 400 });
  }

  const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 80) || "download";
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (formatId === "mp3") {
    const outPath = path.join(TMP_DIR, `${uniqueId}.mp3`);

    try {
      const ytDlpPath = getDlpPath();
      await execFileAsync(ytDlpPath, [
        "--no-playlist",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--ffmpeg-location", ffmpegStatic ? path.dirname(ffmpegStatic) : "ffmpeg",
        "-o", outPath,
        url,
      ], { maxBuffer: 1024 * 1024 * 10 });

      // Find the actual output file (yt-dlp may append .mp3)
      const finalPath = fs.existsSync(outPath) ? outPath : `${outPath}.mp3`;

      if (!fs.existsSync(finalPath)) {
        return NextResponse.json({ error: "Output file not found after conversion" }, { status: 500 });
      }

      const fileBuffer = fs.readFileSync(finalPath);
      fs.unlink(finalPath, () => {});

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Disposition": `attachment; filename="${safeTitle}.mp3"`,
          "Content-Length": String(fileBuffer.byteLength),
        },
      });
    } catch (err: unknown) {
      console.error("MP3 download error:", err);
      if (fs.existsSync(outPath)) fs.unlink(outPath, () => {});
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: "MP3 download failed", details: message }, { status: 500 });
    }
  } else {
    // Video download
    const height = parseInt(formatId.replace("p", ""), 10);
    if (isNaN(height)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    const outTemplate = path.join(TMP_DIR, `${uniqueId}.%(ext)s`);
    const formatSelector = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;

    try {
      const ytDlpPath = getDlpPath();
      await execFileAsync(ytDlpPath, [
        "--no-playlist",
        "-f", formatSelector,
        "--merge-output-format", "mp4",
        "--ffmpeg-location", ffmpegStatic ? path.dirname(ffmpegStatic) : "ffmpeg",
        "-o", outTemplate,
        url,
      ], { maxBuffer: 1024 * 1024 * 10, timeout: 10 * 60 * 1000 });

      // Find the downloaded file
      const files = fs.readdirSync(TMP_DIR).filter(f => f.startsWith(uniqueId));
      if (files.length === 0) {
        return NextResponse.json({ error: "Download failed — file not found" }, { status: 500 });
      }

      const outFile = path.join(TMP_DIR, files[0]);
      const ext = path.extname(outFile).slice(1) || "mp4";
      const fileBuffer = fs.readFileSync(outFile);
      fs.unlink(outFile, () => {});

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": ext === "mkv" ? "video/x-matroska" : "video/mp4",
          "Content-Disposition": `attachment; filename="${safeTitle} [${formatId}].${ext}"`,
          "Content-Length": String(fileBuffer.byteLength),
        },
      });
    } catch (err: unknown) {
      console.error("Video download error:", err);
      const message = err instanceof Error ? err.message : String(err);
      // Clean up any partial files
      try {
        const files = fs.readdirSync(TMP_DIR).filter(f => f.startsWith(uniqueId));
        files.forEach(f => fs.unlink(path.join(TMP_DIR, f), () => {}));
      } catch {}
      return NextResponse.json({ error: "Video download failed", details: message }, { status: 500 });
    }
  }
}
