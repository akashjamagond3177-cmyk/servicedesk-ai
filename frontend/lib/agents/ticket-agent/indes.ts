/**
 * Ticket Agent
 * 
 * Handles ticket creation by calling Django DRF API.
 * Same concept as company's ticket creation flow.
 * 
 * Flow:
 * 1. Extract issue details from conversation
 * 2. Call Django API to create ticket
 * 3. Return confirmation to user
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel } from "../shared/model";
import { buildTicketPrompt } from "./prompt";

// Django backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

/**
 * Ticket data structure
 * Matches your Django Issue model exactly!
 */
interface TicketData {
  summary: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: string;
}

/**
 * Create ticket in Django DB.
 * Calls POST /api/issues/
 */
async function createTicketInDjango(
  ticketData: TicketData
): Promise<{ success: boolean; ticketId?: number; error?: string }> {
  try {
    console.log("[Ticket] Creating ticket in Django:", ticketData);

    const response = await fetch(`${BACKEND_URL}/issues/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ticketData),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Ticket] Django API error:", error);
      return { success: false, error };
    }

    const data = await response.json();
    console.log("[Ticket] Ticket created successfully:", data);
    return { success: true, ticketId: data.id };

  } catch (error) {
    console.error("[Ticket] Error creating ticket:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Extract ticket details from conversation using LLM.
 * LLM reads conversation and extracts:
 * - summary
 * - description  
 * - priority
 */
async function extractTicketDetails(
  userMessage: string
): Promise<TicketData> {
  const model = getChatModel();

  const extractionPrompt = `
Extract ticket details from this message and respond ONLY with JSON:
{
  "summary": "brief title of the issue (max 100 chars)",
  "description": "detailed description of the issue",
  "priority": "high/medium/low based on urgency"
}

Rules:
- summary must be short and clear
- priority: high=critical/urgent, medium=normal, low=minor
- respond with ONLY JSON, no other text

Message: "${userMessage}"
`;

  const response = await model.invoke([
    new HumanMessage(extractionPrompt)
  ]);

  try {
    const content = response.content as string;
    // Clean JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || userMessage.substring(0, 100),
        description: parsed.description || userMessage,
        priority: parsed.priority || "medium",
        status: "OPEN",
      };
    }
  } catch (e) {
    console.error("[Ticket] JSON parse error:", e);
  }

  // Fallback if extraction fails
  return {
    summary: userMessage.substring(0, 100),
    description: userMessage,
    priority: "medium",
    status: "OPEN",
  };
}

/**
 * Main Ticket Agent function.
 * Takes user message and creates ticket.
 */
export async function invokeTicketAgent(
  userMessage: string,
  userContext?: { name?: string; email?: string; department?: string }
): Promise<AsyncGenerator<string, void, unknown>> {

  async function* streamResponse() {
    try {
      // Step 1: Tell user we're processing
      yield JSON.stringify({
        type: "token",
        data: "Creating your ticket... Please wait.\n\n"
      }) + "\n";

      // Step 2: Extract ticket details from message
      console.log("[Ticket] Extracting ticket details...");
      const ticketData = await extractTicketDetails(userMessage);

      // Step 3: Create ticket in Django
      const result = await createTicketInDjango(ticketData);

      // Step 4: Stream response based on result
      if (result.success) {
        const successMessage = `**Ticket Created Successfully!**

**Ticket ID:** #${result.ticketId}
**Summary:** ${ticketData.summary}
**Priority:** ${ticketData.priority}
**Status:** Open

Your ticket has been submitted to the IT support team. They will get back to you shortly.`;

        yield JSON.stringify({
          type: "token",
          data: successMessage
        }) + "\n";

      } else {
        yield JSON.stringify({
          type: "token",
          data: `Sorry, I couldn't create the ticket. Error: ${result.error}. Please try again or contact IT support directly.`
        }) + "\n";
      }

      // Step 5: Signal completion
      yield JSON.stringify({ type: "done", data: null }) + "\n";

    } catch (error) {
      console.error("[Ticket] Error:", error);
      yield JSON.stringify({
        type: "error",
        data: error instanceof Error ? error.message : "Unknown error"
      }) + "\n";
    }
  }

  return streamResponse();
}
