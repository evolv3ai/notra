(() => {
  const { apiUrl, clientId, ...options } = document.currentScript.dataset;
  const endpoint = new URL("/", apiUrl ?? "https://basket.databuddy.cc");
  endpoint.searchParams.set("client_id", clientId);
  fetch(endpoint, {
    method: "POST",
    body: JSON.stringify({
      type: "track",
      name: "screen_view",
      path: location.href,
      title: document.title,
      options,
    }),
    headers: { "Content-Type": "text/plain" },
  });
})();
