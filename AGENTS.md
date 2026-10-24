# Writing for terminalvalue.net

This repo is the source of an AI engineering blog. Posts are Markdown files that `blog/build.mjs` turns into a static site. `projects/terminal-value-pipeline/` is an archived project from February 2026. Don't change it unless asked.

## Posts

- Start a post with `npm run new -- <slug>`. This copies [`blog/templates/post/`](./blog/templates/post/index.md) to `blog/posts/<slug>/` as a draft. The template shows every element a post can use.
- Front matter is flat `key: value`: `title`, `date` (YYYY-MM-DD), `description` (one sentence), and `draft: true` until it's ready. Every post should also have `image: cover.png`: a 1200x630 image shown on the home page and as the link preview. Keep the subject in the middle, because the home page crops the top and bottom.
- Keep images and data files in the post's folder, and link them by file name. A missing image fails the build.
- Preview with `npm run dev` (http://localhost:8788). `npm run deploy:dev` publishes drafts to https://dev.terminal-value.pages.dev, which is noindex. `npm run deploy` publishes to https://terminalvalue.net. Only run it when the author asks.

## Format

| Write                                            | Get                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `![alt](file.png "Caption")` on its own line     | A zoomable figure with a caption                                              |
| `![alt](a.png "Before") → ![alt](b.png "After")` | Two figures on one line                                                       |
| `> [!NOTE]` as the first line of a quote         | An info box                                                                   |
| `[^name]` and `[^name]: text`                    | Numbered footnotes at the end                                                 |
| Fenced code with a language                      | Muted highlighting (js, ts, json, html, css, sh, python, md, xml, yaml, diff) |

## Style

- Lead with the result. The reader should see why the post matters before the first heading.
- Short paragraphs, plain words, one point each. No hype, no filler.
- Every number should trace to a source. Link the raw data (for example, a JSONL file in the post folder) in a footnote.
- Code blocks: under about 60 characters wide, cut down to the lines that matter, and marked as abridged when they are.
- Captions say what to notice, not what the image is. Alt text describes the image for someone who can't see it.
- Put expert detail in footnotes, so the main text stays an easy read.
