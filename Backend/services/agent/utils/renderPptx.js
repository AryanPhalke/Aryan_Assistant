import PptxGenJS from "pptxgenjs";
import parseDeck, { countLines } from "./parseDeck.js";

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
const INTRO_LINE_H = 0.5;

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

const addContentSlide = (pptx, page) => {
  const slide = pptx.addSlide();
  slide.addText(page.title, {
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

// Turns Markdown into a PowerPoint file and returns it as a Buffer
const renderPptx = async (markdown) => {
  const deck = parseDeck(markdown);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;

  addTitleSlide(pptx, deck);
  deck.pages.forEach((page) => addContentSlide(pptx, page));

  return pptx.write({ outputType: "nodebuffer" });
};

export default renderPptx;
