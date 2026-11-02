// Helpers for the agents that turn an LLM's Markdown into a file (pdf, ppt)

// Models sometimes add reasoning or wrap the document in a code fence, which
// would otherwise end up in the file
export const cleanMarkdown = (text) => {
  const trimmed = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i)?.[1] ?? trimmed;
};

// "# Notes on Photosynthesis" -> "notes-on-photosynthesis.pdf"
export const buildFileName = (markdown, extension) => {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? "";
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "document"}.${extension}`;
};
