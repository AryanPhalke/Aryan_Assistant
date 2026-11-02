import { getModel } from "../config/llmmodel.js";
import uploadToS3 from "../utils/uploadtoS3.js";
import renderPdf from "../utils/renderPdf.js";
import { cleanMarkdown, buildFileName } from "../utils/document.js";
import { filePath } from "../controllers/file.controller.js";

const PDF_WRITER = `You write documents that are converted into PDF files.
Write the complete document the user asks for: notes, a report, a resume, a
certificate or anything similar. Use the earlier conversation to resolve
follow-ups.

Format:
- Reply with ONLY the document in Markdown: no intro, no closing remarks and
  no code fence around it.
- Start with one "# " heading that is the document's title.
- Use "## " and "### " headings, lists and tables where they help.
- Don't use images, raw HTML or LaTeX. Write equations as plain text, like
  6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂.

Accuracy:
- Never make up facts, numbers, links or sources.
- For personal details you weren't given (names, dates, contact details), use a
  placeholder like [Your Name].`;

export const pdfAgent = async (state) => {
  try {
    const history = (state.history ?? []).slice(-6).map((m) => [
      m.role === "user" ? "human" : "ai",
      m.content,
    ]);

    const res = await getModel("pdf").invoke([
      ["system", PDF_WRITER],
      ...history,
      ["human", state.prompt],
    ]);
    console.log("[agent:pdf] LLM response:", res.content);

    if (res.response_metadata?.finish_reason === "length") {
      console.warn("[agent:pdf] Reply hit the token limit, the document is cut off");
    }

    const markdown = cleanMarkdown(String(res.content));
    if (!markdown) throw new Error("The LLM returned an empty document");

    const fileName = buildFileName(markdown, "pdf");
    const { key } = await uploadToS3({
      userId: state.userId,
      fileName,
      body: await renderPdf(markdown),
    });

    // Markdown link, so it's saved and rendered like any other reply
    return { aiResponse: `Your PDF is ready: [${fileName}](${filePath(key)})` };
  } catch (error) {
    console.error("[agent:pdf] Failed:", error.message);
    return { aiResponse: "Sorry, I couldn't create that PDF right now. Please try again." };
  }
};
