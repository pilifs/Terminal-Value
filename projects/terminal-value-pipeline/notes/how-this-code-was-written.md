# How This Code Was Written (Feb 2026)

99% of this codebase was produced by Gemini 3 Pro. The guiding principle was to never make it harder for Gemini, or another LLM of its caliber, to keep producing code when guided by an expert user in a precise way. The methodology is described in [Approaching LLMs Like an Engineer](./1-approaching-llms-like-an-engineer.md).

My workflow was:

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

## Rules I Followed

- Limit documentation in code or markdown files. Prioritize semantic and self-documenting code. Comments are okay, but only critical domain methods should be verbosely commented. Methods in the sample apps should have minimal to no comments.
- No internal tests. There may be value in tests, but they risk polluting domain context for the LLM. The functional tests in `pipeline/functionalTests` were the compromise.
- No libraries. Using the LLM to implement functionality was preferred over adding a dependency.
- Prioritize pure code without side effects. Any side effects must be mocked or memoized. See manual examples in `../apps/gemini-batch/devMocks`. (In practice this wasn't strictly followed early on, while I was experimenting quickly.)
