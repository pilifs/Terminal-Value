# Writing for terminalvalue.net

This repo is the source of an AI engineering blog. Posts are Markdown files that `blog/build.mjs` turns into a static site. `projects/terminal-value-pipeline/` is an archived project from February 2026. Don't change it unless asked.

## Posts

- Start a post with `npm run new -- <slug>`. This copies [`blog/templates/post/`](./blog/templates/post/index.md) to `blog/posts/<slug>/` as a draft. The template shows every element a post can use.
- Front matter is flat `key: value`: `title`, `date` (YYYY-MM-DD), `description` (one sentence), and `draft: true` until it's ready. Every post should also have `image: cover.png`: a 1200x630 image shown on the home page and as the link preview. Keep the subject in the middle, because the home page crops the top and bottom.
- Keep images and data files in the post's folder, and link them by file name. A missing image fails the build.
- Preview with `npm run dev` (http://localhost:8788). `npm run deploy:dev` publishes drafts to https://dev.terminal-value.pages.dev, which is noindex. `npm run deploy` publishes to https://terminalvalue.net. Only run it when the author asks.

## Software Factory posts

- Start one with `npm run new -- --software-factory <slug>`. This copies `blog/templates/software-factory-post/`, whose body repeats these rules.
- Extra front matter, all flat and optional:
  - `collection: software-factory` lists the post in the section's analysis at `/software-factory/analysis/`, if it also has an `author` line.
  - `author: Filip Stankovic` is the byline. Attribution is explicit: a post without its own `author` line gets no byline and is never listed as the author's analysis, whoever the site's author is. Never add an author line to a post someone else wrote.
  - `featured: true` makes it a candidate for the featured slot. The newest wins.
  - `evidence: evidence.json` names the frozen data the article was written from.
  - `related: software-factory` links a background post, such as one an agent wrote, from the section without listing it as analysis.
- Evidence is frozen. Copy `evidence.json` and every data file it lists into the post's folder, so the article keeps its numbers when the dashboard's data changes or the feed fails. Never update a published article's evidence from a later snapshot: a new analysis gets new evidence. Start from `blog/software-factory/test/fixtures/evidence.incomplete.json`, keep what isn't known `null` and the status `incomplete`, and set `complete` only when every field is real. The build fails when a published post's evidence is missing, incomplete, or doesn't match its files' sha256.
- A draft's evidence may be incomplete or absent. The section never lists a draft, even in the drafts build. Preview it at its own URL with `npm run dev`.
- Name a model by its display name with the raw id beside it, such as "Fable 5.1 (`claude-fable-5-1`)". Map a raw id to a display name only from a documented source. Keep what was measured apart from what you interpret.

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

## Version control and agent loops

- The repo uses jj, colocated with git. Run `python3 llm-dlc/tools/sync.py init` once per clone. Never run `git commit`.
- Commit each feature as soon as it's finished and verified, without asking: `python3 llm-dlc/tools/sync.py commit -m "Summary line" -m "What changed, why, and how it was verified."` The check that follows must report 0 errors.
- Push only when the author asks: `python3 llm-dlc/tools/sync.py push --bookmark main`.
- Unattended loops work through briefs in `llm-dlc/loops/`. See [`llm-dlc/README.md`](./llm-dlc/README.md). A loop never pushes or deploys.
