(() => {
  const [key, options] = window.posthog._i[0];
  fetch(`${options.api_host}/i/v0/e/`, {
    method: "POST",
    body: JSON.stringify({
      api_key: key,
      event: "$pageview",
      properties: {
        $current_url: location.href,
        $host: location.host,
        $pathname: location.pathname,
      },
      fixture_options: options,
    }),
    headers: { "Content-Type": "text/plain" },
  });
})();
