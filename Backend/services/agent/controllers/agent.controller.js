import axios from "axios";
import { graph } from "../graph/graph.js";

// How many earlier messages to send to the LLM as context
const HISTORY_LIMIT = 20;

// Loads the last few messages of a conversation from the chat service,
// oldest first, so the LLM can "remember" what was said earlier
const getHistory = async (conversationId) => {
  if (!conversationId) return [];
  try {
    const { data } = await axios.get(
      `${process.env.CHAT_SERVICE}/get-messages/${conversationId}`,
    );
    // The chat service returns newest first
    return data
      .slice(0, HISTORY_LIMIT)
      .reverse()
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));
  } catch (error) {
    console.error("[agent] Failed to load history:", error.message);
    return [];
  }
};

// Runs the LangGraph workflow: router picks an agent, that agent writes aiResponse
export const runAgent = async (req, res) => {
  try {
    // agent is optional: set when the user picks one in the UI, otherwise the
    // router chooses
    const { prompt, conversationId, agent } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: "prompt is required" });
    }

    // Load earlier messages BEFORE saving the new one, so the prompt
    // isn't included twice
    const history = await getHistory(conversationId);

    // Save the user's message in the chat service (route is /save-messages)
    await axios.post(`${process.env.CHAT_SERVICE}/save-messages`, {
      conversationId,
      content: prompt,
      role: "user",
    });

    // Logged-in user's name, added by the gateway, so every conversation knows it
    const userName = decodeURIComponent(req.headers["x-user-name"] ?? "");

    const result = await graph.invoke({ prompt, history, userName, agent });

    // Agents that aren't built yet (coding, pdf, ppt, imageGen, search) return
    // nothing, so fall back to a message instead of saving an empty reply
    if (!result.aiResponse) {
      result.aiResponse = `The ${result.agent} agent isn't available yet. Please try a general question.`;
    }

    // Save the AI's reply too, so it shows up when the conversation is reopened
    await axios.post(`${process.env.CHAT_SERVICE}/save-messages`, {
      conversationId,
      content: result.aiResponse,
      role: "assistant",
    });

    return res.status(200).json({
      agent: result.agent,
      aiResponse: result.aiResponse,
    });
  } catch (error) {
    return res.status(500).json({ message: `run agent error ${error}` });
  }
};
