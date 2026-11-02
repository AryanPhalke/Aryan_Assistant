import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

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
  maxTokens: 2500,
});

// Shared Gemini chat model (API key comes from GOOGLE_API_KEY in .env).
// maxRetries keeps a busy Gemini server from hanging the request for minutes.
export const geminiLlm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-flash",
  temperature: 0.7,
  maxRetries: 2,
});

// Coding model via OpenRouter (key from CODING_AGENT_KEY in .env).
// OpenRouter speaks the OpenAI API, so ChatOpenAI works with a different baseURL.
// The key is on the free tier, so only ":free" models work; override the model
// with CODING_AGENT_MODEL in .env (list: https://openrouter.ai/models?q=free).
// Low temperature: code should be precise, not creative.
export const codingLlm = new ChatOpenAI({
  apiKey: process.env.CODING_AGENT_KEY,
  model: process.env.CODING_AGENT_MODEL || "cohere/north-mini-code:free",
  temperature: 0.2,
  maxRetries: 2,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

// PDF writer: same Groq model as chat, but more focused and with room for
// long documents.
export const pdfLlm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  temperature: 0.4,
  maxTokens: 4000,
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
      return codingLlm;
    case "pdf":
      return pdfLlm;
    default:
      return llm;
  }
};
