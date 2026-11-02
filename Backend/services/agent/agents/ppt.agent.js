import { getModel } from "../config/llmmodel.js";
import uploadToS3 from "../utils/uploadtoS3.js";
import renderPptx from "../utils/renderPptx.js";
import renderSlidesPdf from "../utils/renderSlidesPdf.js";
import { cleanMarkdown, buildFileName } from "../utils/document.js";
import { filePath } from "../controllers/file.controller.js";

const PPT_WRITER = `You write slide decks that are converted into PowerPoint files.
Write the complete deck the user asks for. Use the earlier conversation to
resolve follow-ups.

Format:
- Reply with ONLY the deck in Markdown: no intro, no closing remarks and no
  code fence around it.
- Start with one "# " heading that is the deck's title, then one short line
  that is its subtitle. These become the title slide.
- Start every other slide with a "## " heading that is the slide's title, under
  8 words.
- Use the number of slides the user asks for, otherwise 6 to 10.
- Give each slide 3 to 5 short bullet points, not paragraphs. Use a table only
  for comparisons.
- Don't use images, raw HTML or LaTeX. Write equations as plain text, like
  6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂.

Accuracy:
- Never make up facts, numbers, links or sources.
- For personal details you weren't given (names, dates, contact details), use a
  placeholder like [Your Name].`;

// Saves a PDF copy of the slides for the artifact panel and returns its path.
// The .pptx is what the user asked for, so a failed preview doesn't fail the reply.
const uploadPreview = async (userId, fileName, markdown) => {
  try {
    const { key } = await uploadToS3({
      userId,
      fileName: fileName.replace(/\.pptx$/, ".pdf"),
      body: await renderSlidesPdf(markdown),
      folder: "ppt",
    });
    return filePath(key);
  } catch (error) {
    console.error("[agent:ppt] Preview failed:", error.message);
    return null;
  }
};

export const pptAgent = async (state) => {
  try {
    const history = (state.history ?? []).slice(-6).map((m) => [
      m.role === "user" ? "human" : "ai",
      m.content,
    ]);

    const res = await getModel("ppt").invoke([
      ["system", PPT_WRITER],
      ...history,
      ["human", state.prompt],
    ]);
    console.log("[agent:ppt] LLM response:", res.content);

    if (res.response_metadata?.finish_reason === "length") {
      console.warn("[agent:ppt] Reply hit the token limit, the deck is cut off");
    }

    const markdown = cleanMarkdown(String(res.content));
    if (!markdown) throw new Error("The LLM returned an empty deck");

    const fileName = buildFileName(markdown, "pptx");
    const { key } = await uploadToS3({
      userId: state.userId,
      fileName,
      body: await renderPptx(markdown),
    });
    const preview = await uploadPreview(state.userId, fileName, markdown);

    // Markdown link, so it's saved and rendered like any other reply. Its title
    // holds the preview's path for the artifact panel; the chat doesn't show it.
    const title = preview ? ` "preview:${preview}"` : "";
    return { aiResponse: `Your presentation is ready: [${fileName}](${filePath(key)}${title})` };
  } catch (error) {
    console.error("[agent:ppt] Failed:", error.message);
    return { aiResponse: "Sorry, I couldn't create that presentation right now. Please try again." };
  }
};
