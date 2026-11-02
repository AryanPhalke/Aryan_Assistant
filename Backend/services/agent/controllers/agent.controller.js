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

// Nodes whose LLM calls are internal steps, not the reply itself: the
// router's agent name, imageGen's rewritten image prompt and pdf's document
const SILENT_NODES = ["router", "imageGen", "pdf"];

// Saves one message in the chat service (route is /save-messages)
const saveMessage = (conversationId, role, content) =>
  axios.post(`${process.env.CHAT_SERVICE}/save-messages`, {
    conversationId,
    role,
    content,
  });

// Same as runAgent, but streams the reply token by token using
// Server-Sent Events (SSE). Each event is one line: data: {json}\n\n
//   { type: "agent", agent }        which agent is answering
//   { type: "token", content }      a piece of the reply, in order
//   { type: "done", agent, aiResponse }  full reply, already saved
//   { type: "error", message }
export const streamAgent = async (req, res) => {
  const { prompt, conversationId, agent } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ message: "prompt is required" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Stops proxies like nginx from buffering the stream in production
    "X-Accel-Buffering": "no",
  });
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  // If the user presses Stop or closes the tab, stop the LLM call too
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    const history = await getHistory(conversationId);
    await saveMessage(conversationId, "user", prompt);
    const userName = decodeURIComponent(req.headers["x-user-name"] ?? "");
    const userId = req.headers["x-user-id"];

    // "messages" mode yields each LLM token as it's generated; "values" mode
    // yields the full state after each step (we keep the last one)
    const stream = await graph.stream(
      { prompt, history, userName, userId, agent },
      { streamMode: ["messages", "values"], signal: abort.signal },
    );

    let finalState = {};
    let announced = false;
    let streamed = false;
    for await (const [mode, chunk] of stream) {
      if (mode === "values") {
        finalState = chunk;
        // Tell the UI which agent was picked as soon as the router decides
        if (chunk.agent && !announced) {
          send({ type: "agent", agent: chunk.agent });
          announced = true;
        }
        continue;
      }
      const [message, metadata] = chunk;
      if (SILENT_NODES.includes(metadata.langgraph_node)) continue;
      if (typeof message.content === "string" && message.content) {
        send({ type: "token", content: message.content });
        streamed = true;
      }
    }

    let aiResponse = finalState.aiResponse;
    // Agents that aren't built yet return nothing (see runAgent)
    if (!aiResponse) {
      aiResponse = `The ${finalState.agent} agent isn't available yet. Please try a general question.`;
    }
    // Replies not written token by token (e.g. imageGen's image) are sent in one piece
    if (!streamed) send({ type: "token", content: aiResponse });

    await saveMessage(conversationId, "assistant", aiResponse);
    send({ type: "done", agent: finalState.agent, aiResponse });
  } catch (error) {
    if (!abort.signal.aborted) {
      console.error("[agent:stream] Failed:", error.message);
      send({ type: "error", message: "Something went wrong. Please try again." });
    }
  } finally {
    res.end();
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

    // Logged-in user's name and id, added by the gateway
    const userName = decodeURIComponent(req.headers["x-user-name"] ?? "");
    const userId = req.headers["x-user-id"];

    const result = await graph.invoke({ prompt, history, userName, userId, agent });

    // Agents that aren't built yet (ppt, search) return
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
