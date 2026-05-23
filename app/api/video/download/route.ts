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

function getTmpDir(): string {
  const tmpDir = process.platform === "darwin"
    ? path.join(process.cwd(), ".tmp-downloads")
    : os.tmpdir();

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  return tmpDir;
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
  const tmpDir = getTmpDir();

  if (formatId === "mp3") {
    const outPath = path.join(tmpDir, `${uniqueId}.mp3`);

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
    const isBestVideo = formatId === "best";
    const height = isBestVideo ? null : parseInt(formatId.replace("p", ""), 10);
    if (!isBestVideo && (height === null || isNaN(height))) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    const outTemplate = path.join(tmpDir, `${uniqueId}.%(ext)s`);

    // Use a strict format selector — never fall back to a pre-merged low-quality
    // stream ("best") as that silently gives 360p when the merge fails.
    // Instead: force best video-only + best audio-only merge via ffmpeg.
    const formatSelector = isBestVideo
      ? "bestvideo+bestaudio"
      : `bestvideo[height<=${height}]+bestaudio`;

    try {
      const ytDlpPath = getDlpPath();
      await execFileAsync(ytDlpPath, [
        "--no-playlist",
        "--no-warnings",
        "-f", formatSelector,
        "--merge-output-format", "mp4",
        "--ffmpeg-location", ffmpegStatic ? path.dirname(ffmpegStatic) : "ffmpeg",
        "-o", outTemplate,
        url,
      ], { maxBuffer: 100 * 1024 * 1024, timeout: 10 * 60 * 1000 }); // 100MB buffer, 10 min timeout

      // Find the downloaded file
      const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(uniqueId));
      if (files.length === 0) {
        return NextResponse.json({ error: "Download failed — file not found" }, { status: 500 });
      }

      const outFile = path.join(tmpDir, files[0]);
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
        const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(uniqueId));
        files.forEach(f => fs.unlink(path.join(tmpDir, f), () => {}));
      } catch {}
      return NextResponse.json({ error: "Video download failed", details: message }, { status: 500 });
    }
  }
}
