const fixture = process.argv[2];
const result = await Bun.build({
  entrypoints: [fixture],
  target: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "workspace-boundaries",
      setup(builder) {
        builder.onResolve(
          {
            filter:
              /^(nuqs|@tanstack\/react-router|@\/lib\/orpc\/query|@\/lib\/hooks\/(use-site-working-branch|use-site-branch-controls|use-site-brand-defaults|use-site-design-section|use-site-nav-section)|@\/components\/sites\/(site-publish-dialog|site-design-integrations|branches\/site-branch-controls))$/,
          },
          () => ({ path: fixture })
        );
      },
    },
  ],
});
if (!result.success) {
  throw new AggregateError(result.logs, "Site workspace fixture build failed");
}
process.stdout.write(await result.outputs[0].text());
