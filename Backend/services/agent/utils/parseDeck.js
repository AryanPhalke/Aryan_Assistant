import { marked } from "marked";

// Slides don't overflow onto a new slide by themselves, so long ones are split
// into "(cont.)" slides before they're drawn. These limits fit the body area of
// a 13.33 x 7.5 inch slide at font size 24.
const MAX_LINES = 8;
const CHARS_PER_LINE = 70;
const MAX_TABLE_ROWS = 7;
// Text this short stays on the same slide as the table after it
const MAX_INTRO_LINES = 2;

// Plain text of inline Markdown: "**bold** [link](url)" -> "bold link"
const inlineText = (tokens = []) =>
  tokens
    .map((token) => {
      if (token.type === "br" || (token.type === "html" && /^<br/i.test(token.text))) return " ";
      return token.tokens ? inlineText(token.tokens) : (token.text ?? "");
    })
    .join("");

// Flattens a list, keeping how deep each bullet is nested
const listBlocks = (list, level = 0) =>
  list.items.flatMap((item) => {
    const text = item.tokens.filter((t) => t.type !== "list").flatMap((t) => t.tokens ?? []);
    const nested = item.tokens.filter((t) => t.type === "list");
    return [
      { text: inlineText(text), bullet: true, level },
      ...nested.flatMap((list) => listBlocks(list, level + 1)),
    ];
  });

export const countLines = (block) => Math.max(1, Math.ceil(block.text.length / CHARS_PER_LINE));

// Splits one slide's blocks into pages that fit on a slide
const paginate = (blocks) => {
  const pages = [];
  let items = [];
  let lines = 0;
  const flush = () => {
    if (items.length) pages.push({ items });
    items = [];
    lines = 0;
  };

  for (const block of blocks) {
    if (block.rows) {
      let intro = [];
      if (lines <= MAX_INTRO_LINES) {
        intro = items;
        items = [];
      }
      flush();
      for (let i = 0; i < block.rows.length; i += MAX_TABLE_ROWS) {
        pages.push({
          items: i === 0 ? intro : [],
          header: block.header,
          rows: block.rows.slice(i, i + MAX_TABLE_ROWS),
        });
      }
      lines = 0;
      continue;
    }
    if (lines + countLines(block) > MAX_LINES) flush();
    items.push(block);
    lines += countLines(block);
  }
  flush();
  // A slide with only a title (e.g. "Thank You") is still a slide
  return pages.length ? pages : [{ items: [] }];
};

// Turns the Markdown into { title, subtitle, pages }: "# " is the title slide
// and each "## " starts a new slide. A page is one slide to draw:
// { title, items, header?, rows? }, where an item is a bullet, a line of text or
// a line of code. The .pptx and its preview PDF both draw these pages.
const parseDeck = (markdown) => {
  const deck = { title: "", subtitle: "" };
  const slides = [];
  let slide;

  for (const token of marked.lexer(markdown)) {
    if (token.type === "space" || token.type === "hr") continue;

    if (token.type === "heading" && token.depth === 1 && !deck.title) {
      deck.title = inlineText(token.tokens);
      continue;
    }
    if (token.type === "heading" && token.depth <= 2) {
      slide = { title: inlineText(token.tokens), blocks: [] };
      slides.push(slide);
      continue;
    }
    if (!slide && token.type === "paragraph" && !deck.subtitle) {
      deck.subtitle = inlineText(token.tokens);
      continue;
    }
    if (!slide) {
      slide = { title: deck.title, blocks: [] };
      slides.push(slide);
    }

    if (token.type === "list") {
      slide.blocks.push(...listBlocks(token));
    } else if (token.type === "table") {
      slide.blocks.push({
        header: token.header.map((cell) => inlineText(cell.tokens)),
        rows: token.rows.map((row) => row.map((cell) => inlineText(cell.tokens))),
      });
    } else if (token.type === "code") {
      slide.blocks.push(...token.text.split("\n").map((line) => ({ text: line, code: true })));
    } else {
      slide.blocks.push({ text: token.tokens ? inlineText(token.tokens) : (token.text ?? "") });
    }
  }
  if (!slides.length) throw new Error("The deck has no slides");

  deck.pages = slides.flatMap((s) =>
    paginate(s.blocks).map((page, i) => ({
      ...page,
      title: i === 0 ? s.title : `${s.title} (cont.)`,
    })),
  );
  return deck;
};

export default parseDeck;
