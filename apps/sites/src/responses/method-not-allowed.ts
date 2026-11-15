export function methodNotAllowed(allow: string): Response {
  return new Response("Method not allowed", {
    status: 405,
    headers: { Allow: allow },
  });
}
