---
title: Analysis title, plain and specific
date: 2026-01-01
description: One sentence that says what the reader will learn. Used on the index page, in RSS and in llms.txt.
collection: software-factory
author: Filip Stankovic
featured: false
# evidence: evidence.json
image: cover.png
draft: true
---

> [!NOTE]
> Guidance for a Software Factory analysis. Delete this box, and replace `cover.png`, before publishing.
>
> - **Frozen evidence.** Copy the data this post uses into its own folder: `evidence.json` (start from `blog/software-factory/test/fixtures/evidence.incomplete.json`) and every file it lists. Then remove the `# ` in front of `evidence:` above. The build checks each file's sha256. A later snapshot never updates a published post; a new analysis gets new evidence.
> - **Unknowns stay null.** A draft's evidence may say `incomplete`. Mark it `complete` only when every field is real. Nothing is filled in to make it pass.
> - **Measured versus interpreted.** Say which numbers come from the evidence and which sentences are your reading of them. Every number should trace to a file in this folder.
> - **Model names.** Give the raw model id beside the display name, such as Fable 5.2 (`claude-fable-5-2`), and say how sessions were mapped to each.

Open with what you observed and why it matters, in one or two sentences.

## A section heading

Keep paragraphs short. Each one should make a single point. Link the raw data in a footnote.[^data]

[^data]: The data used here is in [`evidence.json`](evidence.json), with the files it lists.
