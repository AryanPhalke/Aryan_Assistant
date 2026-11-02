import axios from "axios";
import { getModel } from "../config/llmmodel.js";

const MAX_RESULTS = 5;

// Turns "what about yesterday's match?" into a query that works on its own
const buildQuery = async (state) => {
  const recent = (state.history ?? [])
    .slice(-4)
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join("\n");

  try {
    const res = await getModel("router").invoke([
      [
        "system",
        `Rewrite the user's latest message as one short web search query.
Use the conversation to resolve words like "it" or "that". Today's date is ${new Date().toDateString()}.
Reply with ONLY the query.`,
      ],
      ["human", `Conversation:\n${recent}\n\nLatest message: ${state.prompt}`],
    ]);
    console.log("[agent:search] LLM response:", res.content);
    return String(res.content).trim() || state.prompt;
  } catch (error) {
    console.error("[agent:search] Query rewrite failed:", error.message);
    return state.prompt;
  }
};

// Fetches live web results and leaves them in state; the chat agent runs next
// and writes the reply from them
export const searchAgent = async (state) => {
  try {
    const query = await buildQuery(state);

    const { data } = await axios.post(
      "https://api.tavily.com/search",
      { query, max_results: MAX_RESULTS, search_depth: "basic" },
      {
        headers: { Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
        timeout: 10000,
      },
    );

    if (!data.results?.length) {
      return { searchResults: "The web search returned no results." };
    }

    const searchResults = data.results
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
      .join("\n\n");
    console.log("[agent:search] Search results:", searchResults);

    return { searchResults };
  } catch (error) {
    console.error("[agent:search] Search failed:", error.message);
    return { searchResults: "The web search failed." };
  }
};
