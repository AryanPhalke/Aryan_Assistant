import { StateGraph, START, END } from "@langchain/langgraph";
import { agentState } from "./state.js";
import { router } from "./router.js";
import { chatAgent } from "../agents/chat.agent.js";
import { codingAgent } from "../agents/coding.agent.js";
import { imageGenAgent } from "../agents/imageGen.agent.js";
import { pptAgent } from "../agents/ppt.agent.js";
import { pdfAgent } from "../agents/pdf.agent.js";
import { searchAgent } from "../agents/search.agent.js";

const workflow = new StateGraph(agentState);

workflow.addNode("router", router);
workflow.addNode("chat", chatAgent);
workflow.addNode("coding", codingAgent);
workflow.addNode("imageGen", imageGenAgent);
workflow.addNode("ppt", pptAgent);
workflow.addNode("pdf", pdfAgent);
workflow.addNode("search", searchAgent);

workflow.addEdge(START, "router");

// Router sets state.agent; pick the matching node (fallback: chat)
workflow.addConditionalEdges(
  "router",
  (state) => {
    switch (state.agent) {
      case "chat":
        return "chat";
      case "coding":
        return "coding";
      case "imageGen":
        return "imageGen";
      case "ppt":
        return "ppt";
      case "pdf":
        return "pdf";
      case "search":
        return "search";
      default:
        return "chat";
    }
  },
  ["chat", "coding", "imageGen", "ppt", "pdf", "search"],
);

workflow.addEdge("chat", END);
workflow.addEdge("coding", END);
workflow.addEdge("imageGen", END);
workflow.addEdge("ppt", END);
workflow.addEdge("pdf", END);
workflow.addEdge("search", END);

export const graph = workflow.compile();
