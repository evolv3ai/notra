export const DIALOG_CONFIRM_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>Dialog confirm regression</title>
  <style>
    svg { width: 16px; height: 16px; }
    [data-slot$="overlay"] { display: none; }
    [data-slot$="content"] { position: fixed; inset: 20px; background: white; padding: 16px; }
  </style>
</head>
<body><div id="root"></div><script type="module" src="/fixture.js"></script></body>
</html>`;
