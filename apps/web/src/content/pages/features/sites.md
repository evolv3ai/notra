# Sites

Push to GitHub, and your blog is live. Write posts as MDX in your repository. Notra builds every push and hosts your blog and changelog on blog.acme.com or acme.com/blog.

[Start for free](https://app.usenotra.com/signup) or [book a call](https://www.usenotra.com/contact.md).

## Everything a blog needs, nothing to run

Notra builds, hosts and serves the site. You write posts and merge pull requests.

### A preview for every pull request

Each pull request gets its own private link and a GitHub check. Merging to main switches the whole site live at once.

### On your domain, or under /blog

Point a subdomain at Notra, or serve acme.com/blog with one rewrite from the website you already run. SSL is included.

### Readable by AI engines

Every page also answers as clean Markdown, and every deploy writes llms.txt, sitemaps and RSS. There's nothing to set up.

### Looks like the rest of your website

Set colors, fonts and navigation in blog.json, add your own header and CSS, and use your own React components in posts.

## From repository to live blog

### 1. Import your repository

Install the Notra GitHub App and pick the repository. Posts go in blog/ and changelog entries in changelog/.

### 2. Merge the starter PR

Notra opens a pull request with your logo, colors and links from Brand Identity. Merge it and the site is live.

### 3. Add your domain

Point blog.acme.com at Notra, or serve acme.com/blog with a rewrite from the website you already run.

## Every post, also in Markdown

Every post also answers as clean Markdown, at the same URL with Accept: text/markdown or with .md on the end. Each deploy writes llms.txt, a sitemap and RSS as well.

- Title, summary, authors and tags at the top
- No navigation, scripts or styles to parse
- Linked from every page so crawlers find it

```bash
curl -H "Accept: text/markdown" https://meridian-editorial.notra.site/blog/the-diagram-and-the-street
```

## Frequently asked questions

### Can I use Notra Sites today?

Yes. Sites is available in every workspace. Open Sites in the dashboard and import a repository to get started.

### Do I need a special repository?

No. Use a new repository or a folder in an existing one, including a monorepo. Notra only reads the site folder with blog/, changelog/ and an optional blog.json, and never runs your app's build.

### Can the blog live at acme.com/blog?

Yes. Serve it under a path with a rewrite from the website you already run, with guides for Vercel, Next.js, Netlify, Cloudflare and nginx, or point a subdomain like blog.acme.com at Notra.

### Can I see a post before it goes live?

Yes. Every pull request gets a private preview link, and the GitHub check lists any build error with the file and line to fix. Merging switches the whole site live at once.

### Will it look like the rest of my website?

Set colors, fonts, layout and navigation in blog.json, add your own header, footer and CSS, and use your own React components in posts.

### Can AI engines read my posts?

Every page has a Markdown version, and each site ships llms.txt, sitemaps, RSS and structured data without any setup.

## Ship your blog like you ship code

Import a repository from your dashboard and your first post is live in minutes.
