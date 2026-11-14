---
title: Fable 5.1 vs. 5.2
date: 2026-11-14
description: Placeholder. One sentence that says what the reader will learn from comparing Fable 5.1 and Fable 5.2 in the Software Factory.
collection: software-factory
author: Filip Stankovic
featured: false
evidence: evidence.json
image: cover.png
draft: true
---

> [!NOTE]
> Draft scaffold. Every line below is a prompt for the author, not a finding. Delete this box before publishing.
>
> - **The date is a placeholder,** set when the scaffold was made. It is not a publication commitment; use the real publication date.
> - **No raw model id is mapped to Fable 5.2 yet.** The audited data has `claude-fable-5-1` only. The comparison needs a documented alias and cohort mapping, from data the author will import from another project. Don't infer it from other ids.
> - **The evidence is incomplete on purpose.** `evidence.json` is a copy of the incomplete fixture, with honest nulls. Fill each field from the imported data, list and checksum its files, and mark it `complete` only when every field is real.
> - **Before publishing:** replace `cover.png` with a relevant 1200x630 cover, write the description, and remove `draft: true`.

_Prompt: In one or two sentences, what did you observe, and why does it matter to someone running agents?_

## What I observed and why it matters

_Prompt: What changed when the Software Factory moved from Fable 5.1 to Fable 5.2? What made you look closer? Who should care, and what decision does this inform?_

## Exact model identities, effort, harness, and other configuration changes

_Prompt: Give each model's raw id beside its display name: Fable 5.1 (`claude-fable-5-1`) and Fable 5.2 (raw id not mapped yet). Which effort level, harness and version, and prompts or settings did each cohort use? What else changed between the two periods that could explain a difference?_

## Workload and cohort selection, dates, sample sizes, and exclusions

_Prompt: Which sessions are in each cohort, and how were they mapped to each model? What are the date ranges and timezone, and how many sessions or tasks are in each? What was excluded, and why? Are the two workloads comparable?_

## Observed differences in outcomes, rework, duration, usage, and cache behavior

_Prompt: Where measured, how did outcomes, rework and intervention, duration, usage, and cache behavior differ? Give each number from the evidence, with its source in a footnote. Say which metrics were not measured or not comparable._

## Concrete incidents and qualitative details the aggregates miss

_Prompt: Which specific sessions or incidents show something the aggregates miss? What did a typical failure or success look like? Link the trace or file for each._

## What I am changing in the Software Factory as a result

_Prompt: What will you do differently: model choice, effort, harness, briefs, review? What would make you change your mind?_

## Method, frozen evidence, limitations, and unresolved questions

_Prompt: How were the data collected, normalized and compared? Which snapshot and metric-definition version does the evidence freeze? What are the known gaps and confounders? What remains open?_[^data]

[^data]: The data used in this analysis is in [`evidence.json`](evidence.json), with the files it lists. It is incomplete until the cohort mapping is supplied.
