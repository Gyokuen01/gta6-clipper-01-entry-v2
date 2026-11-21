// gta6-clipper-01 — entry program (Node 22, stdlib only).
//
// Renders a 30-second vertical YouTube Short (1080x1920, 30fps, H.264)
// cut from Rockstar's official GTA VI Trailer 2 (source/ in this repo).
// Only three short moments are used (2-5s each); the trailer's music is
// muted on purpose, so the clip carries no copyrighted audio.
// The pitch is text on screen, which the bounty accepts.
//
// Run:  node main.ts
// Writes: <OUTPUT_DIR>/gta6-clipper-v1.mp4  (OUTPUT_DIR defaults to /output,
//   falls back to ./output when /output is not writable).
//
// Structure (30s total):
//   0-2s   HOOK   jet-ski jump, "GTA 6 looks TOO real."
//   2-7s   CUT 1  Leonida aerial, "WELCOME TO LEONIDA"
//   7-12s  CUT 2  beach bench press, "VICE CITY IS BACK"
//   12-15s CUT 3  boat chase + bike wheelie, "REAL GAMEPLAY. ON PS5."
//   15-18s STING  VI logo (letterboxed, full frame)
//   18-22s PITCH  "AI agents are earning prize money making clips like this on make.fun"
//   22-26s PITCH  "Bounties with real USDC rewards"
//   26-30s CLOSE  "make.fun" + "link in description"
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT: string = dirname(fileURLToPath(import.meta.url));
const SRC: string = join(ROOT, "source", "gta6-trailer2-720p.mp4");
const FONT: string = join(ROOT, "fonts", "DejaVuSans-Bold.ttf");

const BASE: string =
  "crop=405:720:437:0,scale=1080:1920:flags=lanczos," +
  "unsharp=5:5:0.7:5:5:0.0,eq=saturation=1.08:contrast=1.04";

type TextLine = { text: string; size: number; y: number; color: string };

function drawtext(t: TextLine): string {
  return (
    `drawtext=fontfile=${FONT}:text='${t.text}':fontsize=${t.size}:` +
    `fontcolor=${t.color}:borderw=3:bordercolor=black:` +
    `x=(w-text_w)/2:y=${t.y}`
  );
}

function run(cmd: string, args: string[]): void {
  try {
    execFileSync(cmd, args, { stdio: "inherit" });
  } catch (e) {
    throw new Error(`command failed: ${cmd} ${args.join(" ")} (${e})`);
  }
}

function videoSeg(
  tmp: string,
  name: string,
  ss: number,
  dur: number,
  texts: TextLine[],
): string {
  let vf = BASE;
  for (const t of texts) vf += "," + drawtext(t);
  const out = join(tmp, `${name}.mp4`);
  run("ffmpeg", [
    "-v", "error", "-y",
    "-ss", String(ss), "-i", SRC, "-t", String(dur),
    "-vf", vf, "-r", "30", "-c:v", "libx264", "-crf", "20",
    "-preset", "medium", "-pix_fmt", "yuv420p", "-an", out,
  ]);
  return out;
}

function fitSeg(tmp: string, name: string, ss: number, dur: number): string {
  // Letterbox the full 16:9 frame into 9:16 (for the wide VI logo).
  const vf =
    "scale=1080:608:flags=lanczos,pad=1080:1920:0:656:black," +
    "eq=saturation=1.08:contrast=1.04";
  const out = join(tmp, `${name}.mp4`);
  run("ffmpeg", [
    "-v", "error", "-y",
    "-ss", String(ss), "-i", SRC, "-t", String(dur),
    "-vf", vf, "-r", "30", "-c:v", "libx264", "-crf", "20",
    "-preset", "medium", "-pix_fmt", "yuv420p", "-an", out,
  ]);
  return out;
}

function blackSeg(tmp: string, name: string, dur: number, texts: TextLine[]): string {
  const vf = texts.map(drawtext).join(",");
  const out = join(tmp, `${name}.mp4`);
  run("ffmpeg", [
    "-v", "error", "-y",
    "-f", "lavfi", "-i", `color=black:s=1080x1920:d=${dur}`,
    "-vf", vf, "-r", "30", "-c:v", "libx264", "-crf", "20",
    "-preset", "medium", "-pix_fmt", "yuv420p", "-an", out,
  ]);
  return out;
}

function main(): void {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error("ffmpeg is required but was not found on PATH");
  }
  if (!existsSync(SRC)) throw new Error(`source footage missing: ${SRC}`);
  if (!existsSync(FONT)) throw new Error(`font missing: ${FONT}`);

  let outDir: string = process.env.OUTPUT_DIR ?? "/output";
  try {
    mkdirSync(outDir, { recursive: true });
  } catch {
    outDir = join(ROOT, "output");
    mkdirSync(outDir, { recursive: true });
  }
  const outFile: string = join(outDir, "gta6-clipper-v1.mp4");

  const tmp: string = mkdtempSync(join(tmpdir(), "gta6-clipper-"));
  try {
    const parts: string[] = [];
    parts.push(
      videoSeg(tmp, "a_hook", 140.0, 2.0, [
        { text: "GTA 6 looks TOO real.", size: 84, y: 300, color: "white" },
      ]),
    );
    parts.push(
      videoSeg(tmp, "b_leonida", 5.0, 5.0, [
        { text: "WELCOME TO LEONIDA", size: 76, y: 1450, color: "white" },
      ]),
    );
    parts.push(
      videoSeg(tmp, "c_vicecity", 37.5, 5.0, [
        { text: "VICE CITY IS BACK", size: 76, y: 1450, color: "white" },
      ]),
    );
    parts.push(
      videoSeg(tmp, "d_ps5", 147.5, 3.0, [
        { text: "REAL GAMEPLAY. ON PS5.", size: 72, y: 1450, color: "white" },
      ]),
    );
    parts.push(fitSeg(tmp, "e_vi", 156.0, 3.0));
    parts.push(
      blackSeg(tmp, "f_pitch", 4.0, [
        { text: "AI agents are earning", size: 64, y: 780, color: "white" },
        { text: "prize money making clips", size: 64, y: 880, color: "white" },
        { text: "like this on make.fun", size: 64, y: 980, color: "white" },
      ]),
    );
    parts.push(
      blackSeg(tmp, "f_rewards", 4.0, [
        { text: "Bounties with real", size: 64, y: 820, color: "yellow" },
        { text: "USDC rewards", size: 64, y: 920, color: "yellow" },
      ]),
    );
    parts.push(
      blackSeg(tmp, "g_close", 4.0, [
        { text: "make.fun", size: 130, y: 800, color: "white" },
        { text: "link in description", size: 56, y: 1020, color: "white" },
      ]),
    );

    const listFile = join(tmp, "concat.txt");
    writeFileSync(
      listFile,
      parts.map((p) => `file '${p}'`).join("\n") + "\n",
    );
    run("ffmpeg", [
      "-v", "error", "-y",
      "-f", "concat", "-safe", "0", "-i", listFile,
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
      "-map", "0:v", "-map", "1:a",
      "-c:v", "libx264", "-crf", "20", "-preset", "medium",
      "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "96k", "-shortest",
      "-movflags", "+faststart", outFile,
    ]);
    console.log(`wrote ${outFile}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
