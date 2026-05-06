/**
 * IT QA Agent
 * 
 * it-qa-agent/index.ts
 * Handles IT support questions using RAG.
 * 
 * Flow:
 * 1. Get KB context from rag-service
 * 2. Build prompt with context
 * 3. Send to LLM
 * 4. Stream response
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel } from "../shared/model";
import { buildSystemPrompt } from "./prompt";

// RAG service URL
const RAG_SERVICE_URL = process.env.NEXT_PUBLIC_RAG_SERVICE_URL || "http://127.0.0.1:8002";

/**
 * Fetch relevant context from RAG service.
 * Calls our FastAPI rag-service POST /retrieve endpoint.
 * 
 * Why separate function?
 * - Clean separation of concerns
 * - Easy to test independently
 * - Easy to replace if RAG service changes
 */
async function getKBContext(query: string): Promise<string> {
  try {
    console.log(`[IT-QA] Fetching KB context for: ${query}`);
    
    const response = await fetch(`${RAG_SERVICE_URL}/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.warn("[IT-QA] RAG service unavailable");
      return "";
    }

    const data = await response.json();
    console.log(`[IT-QA] KB context found: ${data.context ? "yes" : "no"}`);
    return data.context || "";

  } catch (error) {
    console.error("[IT-QA] Error fetching KB context:", error);
    return "";
  }
}

/**
 * Main IT QA Agent function.
 * Takes user message and streams AI response.
 * 
 * Same concept as company's invokeAgent()
 */
export async function invokeITQAAgent(
  userMessage: string,
  userContext?: { name?: string; email?: string; department?: string }
): Promise<AsyncGenerator<string, void, unknown>> {

  async function* streamResponse() {
    try {
      // Step 1: Get KB context from rag-service
      const kbContext = await getKBContext(userMessage);

      // Step 2: Build system prompt with user context
      const systemPrompt = buildSystemPrompt(userContext);

      // Step 3: Build messages array
      // If KB has context → include it
      // If KB has no context → just use system prompt
      const contextMessage = kbContext
        ? `\n\nRelevant Knowledge Base Information:\n${kbContext}`
        : "\n\nNo relevant information found in knowledge base.";

      const messages = [
        new SystemMessage(systemPrompt + contextMessage),
        new HumanMessage(userMessage),
      ];

      // Step 4: Get LLM model
      const model = getChatModel();

      console.log("[IT-QA] Streaming response from LLM...");

      // Step 5: Stream response word by word
      const stream = await model.stream(messages);

      for await (const chunk of stream) {
        const content = chunk.content;
        if (content && typeof content === "string") {
          // Yield each token as JSON
          yield JSON.stringify({ type: "token", data: content }) + "\n";
        }
      }

      // Step 6: Signal completion
      yield JSON.stringify({ type: "done", data: null }) + "\n";

    } catch (error) {
      console.error("[IT-QA] Error:", error);
      yield JSON.stringify({
        type: "error",
        data: error instanceof Error ? error.message : "Unknown error"
      }) + "\n";
    }
  }

  return streamResponse();
}
