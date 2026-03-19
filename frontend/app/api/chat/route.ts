/**
 * Chat API Route
 * 
 * Main entry point for all chat messages.
 * Receives user message → calls agents → streams response.
 * 
 * Same concept as company's API routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { invokeGraphAgent, UserContext } from "@/lib/agents";

/**
 * POST /api/chat
 * 
 * Request body:
 * {
 *   message: string,
 *   userContext?: { name, email, department }
 * }
 * 
 * Response:
 * Streaming text/event-stream
 * Each line is a JSON object:
 * {"type": "token", "data": "word"}
 * {"type": "status", "data": {...}}
 * {"type": "done", "data": null}
 * {"type": "error", "data": "error message"}
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse request body
    const body = await request.json();
    const { message, userContext } = body;

    // Step 2: Validate message
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    console.log(`[API] Received message: "${message}"`);

    // Step 3: Get agent stream
    const agentStream = await invokeGraphAgent(
      message,
      userContext as UserContext
    );

    // Step 4: Create streaming response
    // This is what makes responses stream word by word!
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of agentStream) {
            // Encode chunk as bytes and send
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          // Close stream when done
          controller.close();
        } catch (error) {
          console.error("[API] Stream error:", error);
          controller.error(error);
        }
      },
    });

    // Step 5: Return streaming response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
