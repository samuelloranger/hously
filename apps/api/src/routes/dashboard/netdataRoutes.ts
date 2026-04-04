import { Elysia } from "elysia";
import { auth } from "../../auth";
import { requireUser } from "../../middleware/auth";
import {
  buildNetdataDisabledSummary,
  fetchNetdataSummary,
} from "../../utils/dashboard/netdata";
import { serverError } from "../../utils/errors";

export const dashboardNetdataRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/netdata/summary", async ({ set }) => {
    try {
      return await fetchNetdataSummary();
    } catch (error) {
      console.error("Error fetching Netdata summary:", error);
      return serverError(set, "Failed to get Netdata summary");
    }
  })
  .get("/netdata/stream", async ({ request }) => {
    const encoder = new TextEncoder();
    const signal = request.signal;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let pollTimeout: ReturnType<typeof setTimeout> | null = null;
        let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
        let previousPayload = "";

        const closeStream = () => {
          if (closed) return;
          closed = true;
          if (pollTimeout) clearTimeout(pollTimeout);
          if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
          try {
            controller.close();
          } catch {
            // Stream may already be closed by the runtime.
          }
        };

        const writeChunk = (chunk: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            closeStream();
          }
        };

        const scheduleHeartbeat = () => {
          if (closed) return;
          heartbeatTimeout = setTimeout(() => {
            writeChunk(": ping\n\n");
            scheduleHeartbeat();
          }, 15000);
        };

        const poll = async () => {
          if (closed) return;

          try {
            const snapshot = await fetchNetdataSummary();
            const payload = JSON.stringify(snapshot);
            if (payload !== previousPayload) {
              previousPayload = payload;
              writeChunk(`data: ${payload}\n\n`);
            }

            pollTimeout = setTimeout(() => {
              void poll();
            }, 2000);
          } catch (error) {
            const fallbackPayload = JSON.stringify({
              ...buildNetdataDisabledSummary(
                "Failed to refresh Netdata summary",
              ),
              enabled: true,
              connected: false,
            });
            writeChunk(`data: ${fallbackPayload}\n\n`);
            pollTimeout = setTimeout(() => {
              void poll();
            }, 5000);
            console.error("Netdata stream poll error:", error);
          }
        };

        signal.addEventListener("abort", closeStream);

        writeChunk("retry: 3000\n\n");
        scheduleHeartbeat();
        void poll();
      },
      cancel() {
        // No-op: timers are tied to request abort and internal stream closure.
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });
