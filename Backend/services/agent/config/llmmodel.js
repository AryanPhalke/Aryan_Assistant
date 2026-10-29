import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// Shared Groq chat model (API key comes from GROQ_API_KEY in .env).
// Import this in agents instead of creating a new client each time.
export const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  temperature: 0.7,
});

// Low temperature for predictable output (e.g. router deciding which agent to use)
export const routerLlm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-20b",
  temperature: 0,
});

// Shared Gemini chat model (API key comes from GOOGLE_API_KEY in .env).
// maxRetries keeps a busy Gemini server from hanging the request for minutes.
export const geminiLlm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-flash",
  temperature: 0.7,
  maxRetries: 2,
});

// Picks which LLM an agent should use (falls back to Groq)
export const getModel = (agent) => {
  switch (agent) {
    case "router":
      return routerLlm;
    case "chat":
      return llm;
    case "search":
      return llm;
    case "coding":
      return geminiLlm;
    default:
      return llm;
  }
};
