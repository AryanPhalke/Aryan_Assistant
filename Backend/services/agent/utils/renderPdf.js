import { Marked } from "marked";
import puppeteer from "puppeteer";

const RENDER_TIMEOUT_MS = 30_000;

export const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The Markdown comes from an LLM, so it's untrusted: show raw HTML as plain
// text and images as their alt text, so nothing can load from our server.
// <br> is the exception: models often use it for line breaks in table cells.
const marked = new Marked({
  renderer: {
    html: ({ text }) => (/^<br\s*\/?>$/i.test(text.trim()) ? "<br>" : escapeHtml(text)),
    image: ({ text }) => escapeHtml(text),
  },
});

const STYLES = `
  body { font-family: Arial, "Noto Sans", "Nirmala UI", sans-serif; font-size: 11pt; line-height: 1.55; color: #1e293b; }
  h1 { font-size: 22pt; color: #0f172a; margin: 0 0 12pt; padding-bottom: 6pt; border-bottom: 2px solid #6366f1; }
  h2 { font-size: 15pt; color: #0f172a; margin: 18pt 0 6pt; }
  h3 { font-size: 12pt; color: #334155; margin: 14pt 0 4pt; }
  h1, h2, h3 { break-after: avoid; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 10pt; }
  th, td { border: 1px solid #cbd5e1; padding: 5pt 7pt; text-align: left; }
  th { background: #f1f5f9; }
  tr, pre, blockquote { break-inside: avoid; }
  pre { background: #f1f5f9; padding: 8pt; border-radius: 4pt; font-size: 9pt; white-space: pre-wrap; }
  code { font-family: Consolas, monospace; }
  blockquote { margin: 10pt 0; padding-left: 10pt; border-left: 3px solid #cbd5e1; color: #475569; }
  a { color: #4338ca; }
`;

// Starting Chromium is slow, so one browser is shared by all requests. Created
// on first use, and again if it crashes.
let browser;
const getBrowser = () => {
  browser ??= puppeteer.launch().then(
    (instance) => {
      instance.on("disconnected", () => {
        browser = undefined;
      });
      return instance;
    },
    (error) => {
      browser = undefined;
      throw error;
    },
  );
  return browser;
};

// Prints a complete HTML document to a PDF and returns it as a Buffer
export const printHtml = async (html, options) => {
  const page = await (await getBrowser()).newPage();
  try {
    // The page has everything it needs inline: no scripts, no network
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request) => request.abort());

    await page.setContent(html, { timeout: RENDER_TIMEOUT_MS });
    const pdf = await page.pdf({ printBackground: true, timeout: RENDER_TIMEOUT_MS, ...options });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
};

// Turns Markdown into a PDF and returns it as a Buffer
const renderPdf = (markdown) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLES}</style></head><body>${marked.parse(markdown)}</body></html>`;

  return printHtml(html, {
    format: "A4",
    margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
  });
};

export default renderPdf;
