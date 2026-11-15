export function analyticsRejected(): Response {
  return new Response(null, {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  });
}
