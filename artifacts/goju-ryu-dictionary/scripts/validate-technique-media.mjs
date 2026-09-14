import { readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(projectRoot, "public");
const expectedPoster = { width: 1024, height: 1536, codec: "mjpeg" };
const expectedVideo = { width: 720, height: 1280, duration: 4, tolerance: 0.25 };
const failures = new Map();

function fail(id, message) {
  const messages = failures.get(id) ?? [];
  messages.push(message);
  failures.set(id, messages);
}

function loadJson(filename) {
  try {
    return JSON.parse(readFileSync(join(publicRoot, filename), "utf8"));
  } catch (error) {
    console.error(`Unable to read public/${filename}: ${error.message}`);
    process.exit(1);
  }
}

function assetPath(id, relativePath, label) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    fail(id, `metadata is missing ${label}`);
    return null;
  }

  const fullPath = resolve(publicRoot, normalize(relativePath));
  if (!fullPath.startsWith(`${publicRoot}/`)) {
    fail(id, `${label} points outside public/: ${relativePath}`);
    return null;
  }

  try {
    if (!statSync(fullPath).isFile()) {
      fail(id, `${label} is not a file: ${relativePath}`);
      return null;
    }
  } catch {
    fail(id, `missing ${label}: ${relativePath}`);
    return null;
  }

  return fullPath;
}

function probe(id, fullPath, label) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration,format_name:stream=codec_name,codec_type,width,height,pix_fmt",
      "-of",
      "json",
      fullPath,
    ],
    { encoding: "utf8" },
  );

  if (result.error?.code === "ENOENT") {
    console.error("ffprobe is required to validate technique media but was not found.");
    process.exit(1);
  }
  if (result.status !== 0) {
    fail(id, `${label} cannot be decoded by ffprobe: ${result.stderr.trim() || "unknown error"}`);
    return null;
  }

  try {
    const media = JSON.parse(result.stdout);
    const videoStream = media.streams?.find((stream) => stream.codec_type === "video");
    if (!videoStream) {
      fail(id, `${label} has no video/image stream`);
      return null;
    }
    return { ...media, videoStream };
  } catch (error) {
    fail(id, `${label} returned invalid probe data: ${error.message}`);
    return null;
  }
}

function validateDimensions(id, stream, expected, label) {
  if (stream.width !== expected.width || stream.height !== expected.height) {
    fail(
      id,
      `${label} must be portrait ${expected.width}x${expected.height}; found ${stream.width}x${stream.height}`,
    );
  }
}

function validatePoster(technique) {
  const posterPath = assetPath(technique.id, technique.image, "poster image");
  if (!posterPath) return;

  if (![".jpg", ".jpeg"].includes(extname(posterPath).toLowerCase())) {
    fail(technique.id, `poster image must be JPEG: ${technique.image}`);
  }

  const media = probe(technique.id, posterPath, "poster image");
  if (!media) return;
  validateDimensions(technique.id, media.videoStream, expectedPoster, "poster image");
  if (media.videoStream.codec_name !== expectedPoster.codec) {
    fail(technique.id, `poster image must use JPEG encoding; found ${media.videoStream.codec_name}`);
  }
}

function validateVideo(id, relativePath, kind) {
  const fullPath = assetPath(id, relativePath, `${kind} video`);
  if (!fullPath) return;

  const expectedExtension = `.${kind}`;
  if (extname(fullPath).toLowerCase() !== expectedExtension) {
    fail(id, `${kind} video must have a ${expectedExtension} extension: ${relativePath}`);
  }

  const media = probe(id, fullPath, `${kind} video`);
  if (!media) return;

  const { videoStream } = media;
  validateDimensions(id, videoStream, expectedVideo, `${kind} video`);

  const duration = Number(media.format?.duration);
  if (
    !Number.isFinite(duration) ||
    Math.abs(duration - expectedVideo.duration) > expectedVideo.tolerance
  ) {
    fail(
      id,
      `${kind} video duration must be approximately ${expectedVideo.duration}s (±${expectedVideo.tolerance}s); found ${Number.isFinite(duration) ? `${duration.toFixed(3)}s` : "unknown"}`,
    );
  }

  const allowedCodecs = kind === "mp4" ? ["h264"] : ["vp8", "vp9"];
  if (!allowedCodecs.includes(videoStream.codec_name)) {
    fail(
      id,
      `${kind} video codec must be ${allowedCodecs.join(" or ")}; found ${videoStream.codec_name}`,
    );
  }
  if (videoStream.pix_fmt !== "yuv420p") {
    fail(id, `${kind} video pixel format must be yuv420p; found ${videoStream.pix_fmt}`);
  }
}

const techniques = loadJson("techniques.json");
const terms = loadJson("terms.json");

if (!Array.isArray(techniques) || !Array.isArray(terms)) {
  console.error("public/techniques.json and public/terms.json must both contain arrays.");
  process.exit(1);
}

const techniqueIds = new Set();
for (const technique of techniques) {
  const id = technique?.id;
  if (typeof id !== "string" || id.length === 0) {
    fail("<missing-id>", "technique metadata record has no ID");
    continue;
  }
  if (techniqueIds.has(id)) {
    fail(id, "duplicate record in techniques.json");
    continue;
  }
  techniqueIds.add(id);

  const term = terms.find((candidate) => candidate?.id === id);
  if (!term) {
    fail(id, "missing matching metadata record in terms.json");
  } else if (term.image !== technique.image) {
    fail(id, `poster metadata differs between terms.json and techniques.json`);
  }

  validatePoster(technique);
  validateVideo(id, technique.video, "mp4");
  validateVideo(id, `videos/${id}.webm`, "webm");
}

for (const term of terms) {
  if (term?.image && !techniqueIds.has(term.id)) {
    fail(term.id ?? "<missing-id>", "illustrated term is missing from techniques.json");
  }
}

if (failures.size > 0) {
  console.error(`Technique media validation failed for ${failures.size} technique ID(s):`);
  for (const [id, messages] of [...failures].sort(([a], [b]) => a.localeCompare(b))) {
    console.error(`\n- ${id}`);
    for (const message of messages) console.error(`  • ${message}`);
  }
  process.exit(1);
}

console.log(
  `Technique media validation passed: ${techniques.length} posters, ${techniques.length} MP4 files, and ${techniques.length} WebM files.`,
);