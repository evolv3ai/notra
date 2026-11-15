/** The post's own frontmatter (written in the editor) is not a YAML mapping. */
export class SiteEntryFrontmatterError extends Error {
  constructor() {
    super("The post's frontmatter is not valid YAML");
    this.name = "SiteEntryFrontmatterError";
  }
}
