import { getModel } from "../config/llmmodel.js";

// Must match the node names in graph.js
const AGENTS = ["chat", "search", "coding", "pdf", "ppt", "imageGen"];

const ROUTER_PROMPT = `You are an agent router. Read the user's message and pick the ONE best agent to handle it.

Available agents:
- chat
- search
- coding
- pdf
- ppt
- imageGen

Rules:

chat:
General conversation, explanations, learning, questions, advice, greetings.
Use this when no other agent clearly fits.

search:
Needs fresh or real-time information from the internet: latest news, current events,
today's prices, weather, sports scores, recent releases, "search for ...".

coding:
Writing, fixing, explaining or reviewing code; programming errors, debugging,
algorithms, SQL queries, project setup.

pdf:
Creating or generating a PDF document, report, resume, notes or certificate as a PDF file.

ppt:
Creating a PowerPoint, presentation, slides or slide deck.

imageGen:
Creating, drawing or generating an image, picture, logo, poster, illustration or artwork.

Examples:
"hi, how are you?" -> chat
"what is react?" -> chat
"latest news about AI" -> search
"fix this error in my node code" -> coding
"make a pdf of notes on photosynthesis" -> pdf
"create 10 slides on climate change" -> ppt
"draw a cat wearing sunglasses" -> imageGen

Reply with ONLY the agent name, exactly as written above. No explanation, no punctuation.`;

export const router = async (state) => {
  // The user picked an agent in the UI: use it and skip the LLM call
  if (AGENTS.includes(state.agent)) {
    return { agent: state.agent };
  }

  const llm = getModel("router");

  try {
    const res = await llm.invoke([
      ["system", ROUTER_PROMPT],
      ["human", state.prompt],
    ]);
    console.log("[agent:router] LLM response:", res.content);

    // Clean reply like " Coding." -> "coding" and match it to a real agent name
    const reply = String(res.content).trim().replace(/[^a-zA-Z]/g, "");
    const agent = AGENTS.find((a) => a.toLowerCase() === reply.toLowerCase());

    return { agent: agent || "chat" };
  } catch (error) {
    console.error("[agent:router] Routing failed:", error.message);
    return { agent: "chat" };
  }
};
