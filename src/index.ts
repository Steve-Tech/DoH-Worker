/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { connect } from 'cloudflare:sockets';

let server = "one.one.one.one";

async function dns_query(query: ReadableStream, length: number): Promise<Response> {
  const dns_socket = connect({ hostname: server, port: 53 });
  const dns_writer = dns_socket.writable.getWriter();
  const dns_reader = dns_socket.readable.getReader();
  try {
    await dns_socket.opened;
    // Write the DNS query length
    dns_writer.write(new Uint8Array([(length >> 8) & 0xFF, length & 0xFF]));

    // Pipe the DNS query to the server
    await query.pipeTo(new WritableStream({
      write(chunk) {
        return dns_writer.write(chunk);
      }
    }));

    // Read the DNS response length
    let firstChunk = await dns_reader.read();
    if (!firstChunk.value || firstChunk.value.length < 2) {
      throw new Error("No response received from DNS server");
    }
    let dns_length = (firstChunk.value[0] << 8) | firstChunk.value[1];

    // Create a stream to pipe the DNS response back to the client
    const dns_response = new FixedLengthStream(dns_length);
    const response_writer = dns_response.writable.getWriter();

    // Write the first chunk of the DNS response (after the length bytes)
    response_writer.write(firstChunk.value.subarray(2)).then(async () => {
      response_writer.releaseLock();
      dns_reader.releaseLock();
      // Pipe the rest of the DNS response to the client
      await dns_socket.readable.pipeTo(dns_response.writable);
      dns_socket.close();
    });

    return new Response(dns_response.readable, { headers: { "Content-Type": "application/dns-message" } });
  } catch (error) {
    return new Response("Socket connection failed: " + error, { status: 500 });
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      // Redirect to the GitHub repository for the project
      return Response.redirect("https://github.com/Steve-Tech/DoH-Worker", 302);
    } else if (url.pathname !== "/dns-query") {
      // If the path is not "/dns-query", treat it as the DNS server address
      server = decodeURIComponent(url.pathname.substring(1));
    }

    if (req.method === "GET") {
      const dnsParam = url.searchParams.get("dns");
      if (!dnsParam) {
        return new Response("Missing 'dns' query parameter", { status: 400 });
      }

      try {
        const dnsQuery = Uint8Array.from(
          atob(dnsParam.replace('_', '/').replace('-', '+')), c => c.charCodeAt(0));
        const dnsStream = new ReadableStream({
          start(controller) {
            controller.enqueue(dnsQuery);
            controller.close();
          }
        });

        return dns_query(dnsStream, dnsQuery.length);
      } catch (error) {
        return new Response("Invalid 'dns' query parameter: " + error, { status: 400 });
      }
    } else if (req.method === "POST") {
      if (!req.body) {
        return new Response("No body provided", { status: 400 });
      }

      const lengthHeader = req.headers.get("Content-Length");
      if (!lengthHeader) {
        return new Response("Content-Length header is required", { status: 411 });
      }

      const length = parseInt(lengthHeader, 10);
      if (isNaN(length) || length <= 0) {
        return new Response("Invalid Content-Length header", { status: 400 });
      }

      return dns_query(req.body, length);
    } else {
      console.warn(`Received unsupported method: ${req.method}`);
      return new Response("Method not allowed", { status: 405 });
    }
  },
} satisfies ExportedHandler;
