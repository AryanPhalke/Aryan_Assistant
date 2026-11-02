import { marked } from "marked";
import PptxGenJS from "pptxgenjs";

const FONT = "Calibri";
const CODE_FONT = "Consolas";
const NAVY = "1E1B4B";
const INDIGO = "6366F1";
const TEXT = "334155";
const LINE = "CBD5E1";

// Layout of a 13.33 x 7.5 inch slide
const MARGIN_X = 0.6;
const WIDTH = 12.13;
const BODY_Y = 1.5;
const BODY_H = 5.3;

// PowerPoint doesn't overflow text onto a new slide by itself, so long slides
// are split into "(cont.)" slides before they're drawn. These limits fit the
// body area at font size 24.
const MAX_LINES = 8;
const CHARS_PER_LINE = 70;
const MAX_TABLE_ROWS = 7;
// Text this short stays on the same slide as the table after it
const MAX_INTRO_LINES = 2;
const INTRO_LINE_H = 0.5;

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

// Turns the Markdown into { title, subtitle, slides: [{ title, blocks }] }.
// A block is a bullet, a line of text, a line of code or a table.
const parseDeck = (markdown) => {
  const deck = { title: "", subtitle: "", slides: [] };
  let slide;

  for (const token of marked.lexer(markdown)) {
    if (token.type === "space" || token.type === "hr") continue;

    if (token.type === "heading" && token.depth === 1 && !deck.title) {
      deck.title = inlineText(token.tokens);
      continue;
    }
    if (token.type === "heading" && token.depth <= 2) {
      slide = { title: inlineText(token.tokens), blocks: [] };
      deck.slides.push(slide);
      continue;
    }
    if (!slide && token.type === "paragraph" && !deck.subtitle) {
      deck.subtitle = inlineText(token.tokens);
      continue;
    }
    if (!slide) {
      slide = { title: deck.title, blocks: [] };
      deck.slides.push(slide);
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
  return deck;
};

const countLines = (block) => Math.max(1, Math.ceil(block.text.length / CHARS_PER_LINE));

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

const addTitleSlide = (pptx, deck) => {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  slide.addText(deck.title || "Presentation", {
    x: MARGIN_X,
    y: 2.3,
    w: WIDTH,
    h: 1.6,
    fontFace: FONT,
    fontSize: 44,
    bold: true,
    color: "FFFFFF",
    valign: "bottom",
  });
  if (deck.subtitle) {
    slide.addText(deck.subtitle, {
      x: MARGIN_X,
      y: 4.05,
      w: WIDTH,
      h: 1,
      fontFace: FONT,
      fontSize: 22,
      color: "C7D2FE",
      valign: "top",
    });
  }
};

const addTable = (slide, page, y) => {
  const cell = (text, options) => ({ text, options });
  slide.addTable(
    [
      page.header.map((text) => cell(text, { bold: true, color: "FFFFFF", fill: { color: NAVY } })),
      ...page.rows.map((row) => row.map((text) => cell(text, { color: TEXT }))),
    ],
    {
      // Text boxes have a 0.1 inch inner margin; tables don't, so line them up
      x: MARGIN_X + 0.1,
      y,
      w: WIDTH - 0.2,
      fontFace: FONT,
      fontSize: 16,
      valign: "middle",
      border: { type: "solid", pt: 1, color: LINE },
    },
  );
};

const addItems = (slide, items, h) => {
  slide.addText(
    items.map((item) => ({
      text: item.text,
      options: {
        breakLine: true,
        ...(item.bullet && { bullet: true, indentLevel: item.level }),
        ...(item.bullet && item.level > 0 && { fontSize: 20 }),
        ...(item.code ? { fontFace: CODE_FONT, fontSize: 18 } : { paraSpaceAfter: 12 }),
      },
    })),
    {
      x: MARGIN_X,
      y: BODY_Y,
      w: WIDTH,
      h,
      fontFace: FONT,
      fontSize: 24,
      color: TEXT,
      valign: "top",
    },
  );
};

const addContentSlide = (pptx, title, page) => {
  const slide = pptx.addSlide();
  slide.addText(title, {
    x: MARGIN_X,
    y: 0.35,
    w: WIDTH,
    h: 0.85,
    fontFace: FONT,
    fontSize: 32,
    bold: true,
    color: NAVY,
    valign: "middle",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN_X + 0.1,
    y: 1.2,
    w: 1.2,
    h: 0.05,
    fill: { color: INDIGO },
    line: { color: INDIGO },
  });
  slide.slideNumber = { x: 12.3, y: 6.95, fontFace: FONT, fontSize: 11, color: "94A3B8" };

  if (page.rows) {
    const introLines = page.items.reduce((sum, item) => sum + countLines(item), 0);
    const introH = introLines * INTRO_LINE_H;
    if (page.items.length) addItems(slide, page.items, introH);
    addTable(slide, page, BODY_Y + introH);
  } else if (page.items.length) {
    addItems(slide, page.items, BODY_H);
  }
};

// Turns Markdown into a PowerPoint file and returns it as a Buffer:
// "# " is the title slide, each "## " starts a new slide
const renderPptx = async (markdown) => {
  const deck = parseDeck(markdown);
  if (!deck.slides.length) throw new Error("The deck has no slides");

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;

  addTitleSlide(pptx, deck);
  for (const slide of deck.slides) {
    paginate(slide.blocks).forEach((page, i) => {
      addContentSlide(pptx, i === 0 ? slide.title : `${slide.title} (cont.)`, page);
    });
  }

  return pptx.write({ outputType: "nodebuffer" });
};

export default renderPptx;
