import { getModel } from "../config/llmmodel.js";
import uploadToS3 from "../utils/uploadtoS3.js";
import { filePath } from "../controllers/file.controller.js";

// Free image generation with Pollinations.ai: no API key, the image is just a
// URL. The server downloads the image, saves it in S3 and the chat loads it
// from there (loading the Pollinations link straight from the browser can
// count as another generation and return a "Free limit reached" picture).
const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "flux";
const SIZE = 1024;
// Generating a new image usually takes 3-20 seconds
const TIMEOUT_MS = 60_000;
// Without a key the free tier allows 1 new image every 45 seconds per IP
// (cached images don't count), and the keyless service is sometimes full
// (503). Keep retrying while the total wait stays under this many seconds.
const MAX_WAIT_S = 60;
// Optional key from https://enter.pollinations.ai removes the limit. It's sent
// as a header from the server only, so it never appears in the image link.
const API_KEY = process.env.POLLINATIONS_API_KEY;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Asks Pollinations to generate the image. Returns { image, contentType } on
// success, or { status, retryAfter, message } describing why it failed.
const generate = async (url) => {
  const res = await fetch(url, {
    headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok && res.headers.get("content-type")?.startsWith("image/")) {
    return {
      image: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type"),
    };
  }
  const body = await res.text().catch(() => "");
  // Rate-limit replies say e.g. "Retry after 39s"
  const seconds =
    Number(res.headers.get("retry-after")) || Number(body.match(/after (\d+)\s*s/i)?.[1]);
  return { status: res.status, retryAfter: seconds || null, message: body.slice(0, 300) };
};

const PROMPT_WRITER = `You write prompts for an AI image generator.
Turn the user's request into ONE detailed image prompt: subject, setting,
style, lighting, colours, composition. Use the earlier conversation to resolve
follow-ups like "make it blue" or "same but at night".
Reply with ONLY the prompt, under 60 words, no quotes, no explanation.`;

// Rewrites a short request ("a cat") into a detailed prompt, which gives
// much better images. Falls back to the user's own words if the LLM fails.
const writePrompt = async (state) => {
  try {
    const history = (state.history ?? []).slice(-6).map((m) => [
      m.role === "user" ? "human" : "ai",
      m.content.slice(0, 500),
    ]);
    const res = await getModel("router").invoke([
      ["system", PROMPT_WRITER],
      ...history,
      ["human", state.prompt],
    ]);
    console.log("[agent:imageGen] LLM response:", res.content);
    const text = String(res.content).trim().replace(/^["']|["']$/g, "");
    return text || state.prompt;
  } catch (error) {
    console.error("[agent:imageGen] Prompt rewrite failed:", error.message);
    return state.prompt;
  }
};

export const buildImageUrl = (prompt, seed) => {
  const params = new URLSearchParams({
    width: SIZE,
    height: SIZE,
    seed,
    model: IMAGE_MODEL,
    nologo: "true",
  });
  return `${POLLINATIONS_URL}/${encodeURIComponent(prompt)}?${params}`;
};

export const imageGenAgent = async (state) => {
  const prompt = await writePrompt(state);
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = buildImageUrl(prompt, seed);

  let result;
  try {
    result = await generate(url);
    // Limited or busy: wait as long as Pollinations asks and retry (the chat
    // keeps showing the typing dots meanwhile)
    let waited = 0;
    while (result.retryAfter && waited + result.retryAfter <= MAX_WAIT_S) {
      console.warn(`[agent:imageGen] ${result.status}, retrying in ${result.retryAfter}s`);
      await sleep((result.retryAfter + 1) * 1000);
      waited += result.retryAfter + 1;
      result = await generate(url);
    }
  } catch (error) {
    result = { message: error.message };
  }

  if (!result.image) {
    console.error("[agent:imageGen] Generation failed:", result.status ?? "", result.message);
    return {
      aiResponse:
        result.status === 402
          ? `The free image service allows one new image every 45 seconds. Please try again in about ${result.retryAfter ?? 45} seconds.`
          : "Sorry, I couldn't generate that image right now (the free image service is busy). Please try again in a moment.",
    };
  }

  // Save the image in our S3 bucket and show it from there. If S3 fails, fall
  // back to the Pollinations link (it may show their "limit reached" picture
  // until their cache catches up).
  let src = url;
  try {
    const { key } = await uploadToS3({
      userId: state.userId,
      fileName: "image.jpg",
      body: result.image,
      contentType: result.contentType,
      folder: "images",
    });
    src = filePath(key);
  } catch (error) {
    console.error("[agent:imageGen] S3 upload failed:", error.message);
  }

  // Markdown image, so it's saved and rendered like any other reply
  return {
    aiResponse: `![${prompt.replace(/[[\]]/g, "")}](${src})\n\n*${prompt}*`,
  };
};
