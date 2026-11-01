import axios from "axios";
import { graph } from "../graph/graph.js";

// Runs the LangGraph workflow: router picks an agent, that agent writes aiResponse
export const runAgent = async (req, res) => {
  try {
    const { prompt, conversationId } = req.body;
    await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
      conversationId,
      content: prompt,
      role: "user",
    });
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: "prompt is required" });
    }

    const result = await graph.invoke({ prompt });

    return res.status(200).json({
      agent: result.agent,
      aiResponse: result.aiResponse,
    });
  } catch (error) {
    return res.status(500).json({ message: `run agent error ${error}` });
  }
};
