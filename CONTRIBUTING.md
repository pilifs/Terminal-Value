99% of this codebase was produced by Gemini 3 Pro. The most important guiding principle behind contributing is that you must not make it harder for Gemini, or another LLM product of its caliber, to continue to produce code when guided by an expert user in a precise way. To help build understanding on the methodology behind this, please check out [this blog post](./blog/1-approaching-llms-like-an-engineer.md).

My personal workflow for contributing is as follows:

- Execute the `npm run package-code` script to strip down the codebase to a state where it can be uploaded to an LLM.
- Upload all the files to Gemini 3 Pro in a browser chat window.
- Write a prompt that describes what Gemini should do as concisely as possible. Here's an example:

All files in repo attached to chat. Initial prompt:

```
Here is my full project that demos dynamic generation of web components by LLMs.

Create a helper method that takes in the objects in skiShopResults.js. It iterates through each key, and if the job was successful, takes the web component output (found in fileOutputResult.response.candidates.parts[1].text) and creates a new file in 'examples/ski-shop/public/components/dynamic{componentType}' -- fill in componentType based on the type property.

Do not overwrite a file if it exists and use the same naming format that exists currently. The filename should be either homePage-CLIENT-####.js or orderPage-CLIENT-####.js
```

[Full chat](https://gemini.google.com/share/816018a113b9)

You don't have to follow my workflow, as long as the results follow the contribution guidelines below. If you find a way to improve on my workflow, please share your methodology!

## Contribution Guidelines

- Limit documentation in code or markdown files. Prioritize semantic and self-documenting code. Comments are okay, but only critical domain methods should be verbosely commented. Methods in the sample apps should have minimal to no comments.
- No internal tests. There may be value in tests, but they risk polluting domain context for the LLM. Tests can be contributed to a folder that is ignored by the `packageCodeForLlm.js` script. This is not setup yet, but feel free to contribute it.
- No libraries. A discussion must be started before introducing any new external library. Using the LLM to implement the desired functionality first will almost always be preferred.
- Prioritize pure code without side effects. Any side effects must be mocked or memoized. See manual examples in `./gemini-batch/devMocks` and programattic examples in `./terminal-value/memoizedResults`. (note: this rule is not strictly followed because I was producing code very fast and experimenting in the beginning, so feel free to submit a refactor, but it should be strictly followed now.)
