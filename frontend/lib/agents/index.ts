/**
 * Multi-Agent Orchestrator — Main Entry Point
 * 
 * Same as your company's lib/agents/index.ts
 * Connects all agents together.
 * 
 * Flow:
 * 1. Receive user message
 * 2. Router classifies intent
 * 3. Correct agent handles message
 * 4. Stream response back
 */

import { classifyIntent, AgentType } from "./router-agent";
import { invokeITQAAgent } from "./it-qa-agent";
import { invokeTicketAgent } from "./ticket-agent";

// User context type
export interface UserContext {
  name?: string;
  email?: string;
  department?: string;
}

// Agent labels for UI display
const AGENT_LABELS: Record<AgentType, string> = {
  "it-qa-agent": "IT Support Assistant",
  "ticket-agent": "Ticket Creation Assistant",
};

/**
 * Main entry point — same as company's invokeGraphAgent()
 * 
 * 1. Classifies message → gets agent type
 * 2. Dispatches to correct agent
 * 3. Streams response back
 */
export async function invokeGraphAgent(
  userMessage: string,
  userContext?: UserContext
): Promise<AsyncGenerator<string, void, unknown>> {

  async function* orchestrate() {
    try {
      // Step 1: Classify intent
      yield JSON.stringify({
        type: "status",
        data: { step: "classifying", message: "Classifying your request..." }
      }) + "\n";

      const agentType = await classifyIntent(userMessage);
      const label = AGENT_LABELS[agentType];

      console.log(`[Orchestrator] Selected agent: ${agentType}`);

      // Step 2: Show which agent is handling
      yield JSON.stringify({
        type: "status",
        data: { step: "agent_selected", message: `Routing to ${label}...`, agentType }
      }) + "\n";

      // Step 3: Dispatch to correct agent
      let agentStream: AsyncGenerator<string, void, unknown>;

      if (agentType === "ticket-agent") {
        agentStream = await invokeTicketAgent(userMessage, userContext);
      } else {
        // Default → IT QA Agent
        agentStream = await invokeITQAAgent(userMessage, userContext);
      }

      // Step 4: Show thinking status
      yield JSON.stringify({
        type: "status",
        data: { step: "thinking", message: "Thinking..." }
      }) + "\n";

      // Step 5: Forward all chunks from agent
      for await (const chunk of agentStream) {
        yield chunk;
      }

    } catch (error) {
      console.error("[Orchestrator] Error:", error);
      yield JSON.stringify({
        type: "error",
        data: error instanceof Error ? error.message : "Unknown error"
      }) + "\n";
    }
  }

  return orchestrate();
}
