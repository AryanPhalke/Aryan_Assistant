import { Annotation } from "@langchain/langgraph";

export const agentState = Annotation.Root({
  prompt: Annotation(),
  // Earlier messages in the conversation: [{ role: "user" | "assistant", content }]
  history: Annotation(),
  // Logged-in user's name (from their Google account)
  userName: Annotation(),
  // Logged-in user's id (from the gateway); files are saved under it in S3
  userId: Annotation(),
  // Formatted web results from the search agent, read by the chat agent
  searchResults: Annotation(),
  aiResponse: Annotation(),
  agent: Annotation(),
  converstaionId: Annotation(),
});
