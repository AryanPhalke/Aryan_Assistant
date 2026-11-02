import parseDeck from "./parseDeck.js";
import { escapeHtml, printHtml } from "./renderPdf.js";

// Browsers can't display .pptx files, so the artifact panel shows this PDF
// instead: one page per slide, matching the .pptx's sizes and colours.
const STYLES = `
  @page { size: 13.33in 7.5in; margin: 0; }
  html, body { margin: 0; }
  body { font-family: Calibri, Carlito, Arial, "Noto Sans", "Nirmala UI", sans-serif; color: #334155; }
  .slide { position: relative; width: 13.33in; height: 7.5in; overflow: hidden; break-after: page; }
  .slide:last-child { break-after: auto; }

  .cover { background: #1e1b4b; }
  .cover h1 { position: absolute; left: 0.7in; right: 0.7in; bottom: 3.6in; margin: 0; font-size: 44pt; color: #fff; }
  .cover p { position: absolute; left: 0.7in; right: 0.7in; top: 4.1in; margin: 0; font-size: 22pt; color: #c7d2fe; }

  h2 { position: absolute; left: 0.7in; right: 0.7in; top: 0.35in; height: 0.85in; margin: 0; display: flex; align-items: center; font-size: 32pt; color: #1e1b4b; }
  .rule { position: absolute; left: 0.7in; top: 1.2in; width: 1.2in; height: 0.05in; background: #6366f1; }
  .body { position: absolute; left: 0.7in; right: 0.7in; top: 1.55in; bottom: 0.7in; font-size: 24pt; line-height: 1.2; }
  .number { position: absolute; right: 0.5in; bottom: 0.3in; font-size: 11pt; color: #94a3b8; }

  .item { margin-bottom: 12pt; }
  .bullet { position: relative; padding-left: 0.32in; }
  .bullet::before { content: "•"; position: absolute; left: 0.04in; }
  .nested { font-size: 20pt; }
  .code { font-family: Consolas, monospace; font-size: 18pt; white-space: pre-wrap; min-height: 1em; }

  table { width: 100%; border-collapse: collapse; font-size: 16pt; }
  th, td { border: 1px solid #cbd5e1; padding: 5pt 7pt; text-align: left; }
  th { background: #1e1b4b; color: #fff; }
`;

const itemHtml = (item) => {
  if (item.code) return `<div class="code">${escapeHtml(item.text)}</div>`;
  if (!item.bullet) return `<div class="item">${escapeHtml(item.text)}</div>`;
  const nested = item.level > 0 ? " nested" : "";
  return `<div class="item bullet${nested}" style="margin-left: ${item.level * 0.4}in">${escapeHtml(item.text)}</div>`;
};

const tableHtml = (page) => {
  const row = (cells, tag) =>
    `<tr>${cells.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
  return `<table>${row(page.header, "th")}${page.rows.map((r) => row(r, "td")).join("")}</table>`;
};

const pageHtml = (page, index) => `<section class="slide">
  <h2>${escapeHtml(page.title)}</h2>
  <div class="rule"></div>
  <div class="body">${page.items.map(itemHtml).join("")}${page.rows ? tableHtml(page) : ""}</div>
  <div class="number">${index + 2}</div>
</section>`;

// Turns the same Markdown as renderPptx into a PDF and returns it as a Buffer
const renderSlidesPdf = (markdown) => {
  const deck = parseDeck(markdown);
  const cover = `<section class="slide cover">
    <h1>${escapeHtml(deck.title || "Presentation")}</h1>
    ${deck.subtitle ? `<p>${escapeHtml(deck.subtitle)}</p>` : ""}
  </section>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLES}</style></head><body>${cover}${deck.pages.map(pageHtml).join("")}</body></html>`;

  return printHtml(html, { preferCSSPageSize: true });
};

export default renderSlidesPdf;
