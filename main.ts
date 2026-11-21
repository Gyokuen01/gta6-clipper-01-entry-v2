// main.ts — Reproduce the GTA 6 Short for make.fun's gta6-clipper-01 bounty.
//
// A 30-second vertical YouTube Short (1080x1920, 30fps, H.264, silent AAC)
// cut from Rockstar's official GTA VI Trailer 2. The clip opens with a
// jet-ski hook, runs through three fast Leonida / Vice City moments, holds
// on the VI logo, then pitches make.fun on black cards. The trailer's music
// is muted on purpose (copyrighted audio), so the clip carries no music.
//
// Deterministic: the same trailer + font + ffmpeg build always yields the
// same bytes. Run with `node main.ts`. Output goes to $OUTPUT_DIR (or
// $MAKEFUN_OUTPUT_DIR), falling back to /output when writable, else ./output.
//
// Node 22+, stdlib only. ffmpeg must be on PATH.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(REPO, "source", "gta6-trailer2-720p.mp4");
const FONT = path.join(REPO, "fonts", "DejaVuSans-Bold.ttf");
const OUT_NAME = "gta6-clipper-v1.mp4";

// Vertical 9:16 crop of the 720p frame, upscaled to 1080x1920, sharpened
// and lightly graded. Identical for every trailer moment.
const CROP_FILTER =
  "crop=405:720:437:0,scale=1080:1920:flags=lanczos," +
  "unsharp=5:5:0.7:5:5:0.0,eq=saturation=1.08:contrast=1.04";

// Full 16:9 frame letterboxed into 9:16 (for wide graphics like the VI logo).
const FIT_FILTER =
  "scale=1080:608:flags=lanczos,pad=1080:1920:0:656:black," +
  "eq=saturation=1.08:contrast=1.04";

// One caption line: centred bold text with a black outline for legibility.
function caption(text, size, y, color) {
  const c = color || "white";
  return (
    "drawtext=fontfile=" + FONT + ":text='" + text + "':fontsize=" + size +
    ":fontcolor=" + c + ":borderw=3:bordercolor=black:x=(w-text_w)/2:y=" + y
  );
}

// The eight parts, in order. `ss`/`dur` are seconds into the trailer (for
// the video/fit parts) or the length of a black card. `texts` are the
// captions drawn on that part.
const SEGMENTS = [
  { kind: "video", name: "a_hook", ss: "140.0", dur: "2.0",
    texts: [{ text: "GTA 6 looks TOO real.", size: 84, y: 300 }] },
  { kind: "video", name: "b_leonida", ss: "5.0", dur: "5.0",
    texts: [{ text: "WELCOME TO LEONIDA", size: 76, y: 1450 }] },
  { kind: "video", name: "c_vicecity", ss: "37.5", dur: "5.0",
    texts: [{ text: "VICE CITY IS BACK", size: 76, y: 1450 }] },
  { kind: "video", name: "d_ps5", ss: "147.5", dur: "3.0",
    texts: [{ text: "REAL GAMEPLAY. ON PS5.", size: 72, y: 1450 }] },
  { kind: "fit", name: "e_vi", ss: "156.0", dur: "3.0", texts: [] },
  { kind: "black", name: "f_pitch", dur: "4.0",
    texts: [
      { text: "AI agents are earning", size: 64, y: 780 },
      { text: "prize money making clips", size: 64, y: 880 },
      { text: "like this on make.fun", size: 64, y: 980 },
    ] },
  { kind: "black", name: "f_rewards", dur: "4.0",
    texts: [
      { text: "Bounties with real", size: 64, y: 820, color: "yellow" },
      { text: "USDC rewards", size: 64, y: 920, color: "yellow" },
    ] },
  { kind: "black", name: "g_close", dur: "4.0",
    texts: [
      { text: "make.fun", size: 130, y: 800 },
      { text: "link in description", size: 56, y: 1020 },
    ] },
];

function runFfmpeg(args) {
  const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error("ffmpeg exited " + r.status + ": ffmpeg " + args.join(" "));
  }
}

function renderSegment(seg, dir) {
  const out = path.join(dir, seg.name + ".mp4");
  if (seg.kind === "black") {
    const vf = seg.texts.length
      ? seg.texts.map((t) => caption(t.text, t.size, t.y, t.color)).join(",")
      : "null";
    runFfmpeg([
      "-v", "error", "-y",
      "-f", "lavfi", "-i", "color=black:s=1080x1920:d=" + seg.dur,
      "-vf", vf, "-r", "30",
      "-c:v", "libx264", "-crf", "20", "-preset", "medium",
      "-pix_fmt", "yuv420p", "-an", out,
    ]);
  } else {
    const vf = seg.kind === "fit"
      ? FIT_FILTER
      : [CROP_FILTER].concat(
          seg.texts.map((t) => caption(t.text, t.size, t.y, t.color))
        ).join(",");
    runFfmpeg([
      "-v", "error", "-y",
      "-ss", seg.ss, "-i", SRC, "-t", seg.dur,
      "-vf", vf, "-r", "30",
      "-c:v", "libx264", "-crf", "20", "-preset", "medium",
      "-pix_fmt", "yuv420p", "-an", out,
    ]);
  }
  return out;
}

function resolveOutputDir() {
  const env = process.env.OUTPUT_DIR || process.env.MAKEFUN_OUTPUT_DIR;
  if (env) return env;
  try {
    fs.mkdirSync("/output", { recursive: true });
    fs.accessSync("/output", fs.constants.W_OK);
    return "/output";
  } catch {
    return path.join(process.cwd(), "output");
  }
}

function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "clipper-"));
  try {
    const parts = SEGMENTS.map((seg) => renderSegment(seg, work));
    const listPath = path.join(work, "concat.txt");
    fs.writeFileSync(listPath, parts.map((p) => "file '" + p + "'\n").join(""));
    const outDir = resolveOutputDir();
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, OUT_NAME);
    runFfmpeg([
      "-v", "error", "-y",
      "-f", "concat", "-safe", "0", "-i", listPath,
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
      "-map", "0:v", "-map", "1:a",
      "-c:v", "libx264", "-crf", "20", "-preset", "medium",
      "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "96k", "-shortest",
      "-movflags", "+faststart", outPath,
    ]);
    console.log("DONE " + outPath + " " + fs.statSync(outPath).size + " bytes");
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main();
