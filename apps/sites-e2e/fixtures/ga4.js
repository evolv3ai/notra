(() => {
  const loaded = document.currentScript.src;
  const send = () => {
    const config = window.dataLayer.find((entry) => entry[0] === "config");
    const url = new URL("https://www.google-analytics.com/g/collect");
    url.search = new URLSearchParams({
      v: "2",
      tid: config[1],
      en: "page_view",
      dl: location.href,
      dt: document.title,
      fixture_script_id: new URL(loaded).searchParams.get("id"),
      fixture_cookie_domain: config[2]?.cookie_domain ?? "",
    });
    fetch(url, { method: "POST", body: "", mode: "cors" });
  };
  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", send, { once: true });
  } else {
    send();
  }
})();
