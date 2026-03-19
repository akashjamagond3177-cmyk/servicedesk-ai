/**
 * Router Agent — Intent Classification
 * 
 * Same as your company's router-agent/index.ts
 * Classifies each user message into correct agent.
 * 
 * Flow:
 * 1. Receive user message
 * 2. Send to LLM with routing prompt
 * 3. LLM returns agent type
 * 4. Return agent type to API route
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel } from "../shared/model";
import { ROUTER_SYSTEM_PROMPT } from "./prompt";

// Valid agent types — same as your company!
const VALID_AGENTS = ["it-qa-agent", "ticket-agent"] as const;
export type AgentType = (typeof VALID_AGENTS)[number];

// Default agent if classification fails
export const DEFAULT_AGENT: AgentType = "it-qa-agent";

/**
 * Classify user message into agent type.
 * Same as company's classifyIntent()
 * 
 * Why use LLM for classification?
 * - More flexible than hardcoded rules
 * - Understands context and meaning
 * - Easy to add new agents later
 */
export async function classifyIntent(
  userMessage: string
): Promise<AgentType> {
  try {
    console.log(`[Router] Classifying: "${userMessage}"`);

    const model = getChatModel();

    // Send message to LLM with routing instructions
    const response = await model.invoke([
      new SystemMessage(ROUTER_SYSTEM_PROMPT),
      new HumanMessage(
        `Classify this message: "${userMessage}"`
      ),
    ]);

    // Clean up response
    const raw = (response.content as string)
      .trim()
      .toLowerCase()
      .replace(/['"]/g, "");

    console.log(`[Router] LLM classified as: "${raw}"`);

    // Validate response is a known agent
    if (VALID_AGENTS.includes(raw as AgentType)) {
      return raw as AgentType;
    }

    // Default fallback
    console.warn(`[Router] Unknown agent type: "${raw}", using default`);
    return DEFAULT_AGENT;

  } catch (error) {
    console.error("[Router] Classification failed:", error);
    return DEFAULT_AGENT;
  }
}
