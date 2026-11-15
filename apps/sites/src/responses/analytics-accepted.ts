export function analyticsAccepted(): Response {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
