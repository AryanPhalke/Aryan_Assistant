import { Annotation } from "@langchain/langgraph";

export const agentState = Annotation.Root({
  prompt: Annotation(),
  // Earlier messages in the conversation: [{ role: "user" | "assistant", content }]
  history: Annotation(),
  // Logged-in user's name (from their Google account)
  userName: Annotation(),
  aiResponse: Annotation(),
  agent: Annotation(),
  converstaionId: Annotation(),
});
