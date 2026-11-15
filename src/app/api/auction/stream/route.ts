import { getAuctionState } from '@/lib/auction-service';

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      req.signal.addEventListener('abort', () => {
        isClosed = true;
      });

      const sendState = async () => {
        if (isClosed) return;
        try {
          const state = await getAuctionState();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`));
        } catch {
          // stream closed
        }
      };

      // Send initial state immediately
      sendState();

      // Interval to push updates every 1.5 seconds or on signal
      const interval = setInterval(() => {
        if (isClosed) {
          clearInterval(interval);
          return;
        }
        sendState();
      }, 1500);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
