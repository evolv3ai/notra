(() => {
  const domain = document.currentScript.dataset.domain;
  fetch("https://plausible.io/api/event", {
    method: "POST",
    body: JSON.stringify({ name: "pageview", domain, url: location.href }),
    headers: { "Content-Type": "text/plain" },
  });
})();
