/**
 * Shared Chat Model Configuration
 * 
 * Same concept as my company's shared/model.ts
 * One place to configure LLM — all agents import from here.
 * 
 */

import { ChatGroq } from "@langchain/groq";

// Read config from environment variables
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_TEMPERATURE = parseFloat(process.env.GROQ_TEMPERATURE || "0.1");

// Singleton instance — created only once
// Same pattern as your company!
let modelInstance: ChatGroq | null = null;

/**
 * Returns shared LLM instance.
 * Same as getChatModel() in your company's model.ts
 * 
 * Why singleton?
 * - Creates connection only once
 * - Reuses same instance for all requests
 * - Saves memory and connection overhead
 */
export function getChatModel(): ChatGroq {
  if (!modelInstance) {
    console.log(`[Model] Creating LLM instance: ${GROQ_MODEL}`);
    modelInstance = new ChatGroq({
      apiKey: GROQ_API_KEY,
      model: GROQ_MODEL,
      temperature: GROQ_TEMPERATURE,
      streaming: true,      // word by word streaming
      maxTokens: 4096,
    });
  }
  return modelInstance;
}

// Export constants for logging
export { GROQ_MODEL, GROQ_TEMPERATURE };
