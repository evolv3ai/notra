(() => {
  const website = document.currentScript.dataset.websiteId;
  fetch("https://gateway.umami.is/api/send", {
    method: "POST",
    body: JSON.stringify({
      type: "event",
      payload: {
        website,
        hostname: location.hostname,
        url: location.pathname,
        title: document.title,
        language: navigator.language,
      },
    }),
    headers: { "Content-Type": "text/plain" },
  });
})();
