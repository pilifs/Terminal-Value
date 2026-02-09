### Approaching LLMs Like an Engineer

There is a problem with how I see most people around me approaching LLMs. Most of the focus seems to be in moving as fast as possible to jump on the hype train for some perceived personal gain. This mentality has taken us away from the core of what we do as technologists -- the art of breaking down big problems into a foundation of proven principles that allow us to collectively achieve more. This is what I consider to be the root definition of software engineering. Yet, at the precipice of the largest technical shift (read: opportunity!) of our generation, there seems to be this ever-growing void of applying this form of principled thinking.

I see a few factors behind this. The first is that the paradigm shift hit us at unprecedented speed. Overnight, LLMs went from research curiosities to business commodities. This has given the field very little time to build up a foundation of truth and learning required to support defining best practices around how to use them. Another factor is that the tools are so powerful (perhaps deceptively so), that it has pushed our need to see immediate tangible results into overdrive. This is all compounded by a society whose collective attention span seems to be as low as it has ever been.

## An Analogy For Developers

To make the example more concrete, let's consider the journey of learning web development to solve problems, as analogous to learning how to use LLMs to solve problems.

There is an overwhelming wealth of information available to a new web developer. It's possible to begin your learning journey at the leading edge of abstractions that top industry firms are using. You may even be able to important a few open source programs and get them to run. Does this act now make you an industry-leading web developer?

The journey of becoming a web developer looks more like this: learn basics of HTTP and web / server communication, learn markup, learn languages, learn runtime environments, etc. Once you have that foundation, then you may choose to specialize, and after repeating the cycle a few times, then you may become that industry-leading expert in your area.

Now ask yourself, is this how you are approaching learning about LLMs? How much time have you spent experimenting with the basic building blocks vs. cloning the latest Enterprise-grade agentic toolchain?

The purpose of this blog post is to help guide you towards a foundation of what core concepts may be of applying LLMs to solve real-world problems, just like we do in any other paradigm at our disposal in the software engineering world.

You can see this post is embedded in a code repository. This will serve as my foundation to share examples (commits and LLM interactions) that back up my points, reflective of my own experience. This project itself is doing some cool stuff around using LLMs to generate code. This is fully working but not easy to grok or run. I will write about this in future posts here as it evolves, if there's something worth writing about.

## Defining a "Large Language Model"

There are a few progressive principles that we'll walk through. The most important one is bifurcating the definition of "Large Language Model".

- Base Large Language Models: a commmodity software tool that takes in tokens and produces output reflective of higher order reasoning, if the tokens match its training data well enough. A context window is simply how many tokens the LLM can reason about at any given time. A chat is simply tokens fed back into a context window in a clever way to simulate an ongoing engagement. Examples: Qwen, Llama, phi, etc.
- Large Language Model-based Produts: complex layers of distributed systems made up LLMs and other traditional servers applied in many different contexts, as well as more traditional software tools. Examples: Gemini, ChatGPT, Claude.

The first one is a commodity tool. The second one is a multi-billion dollar software system. Have you ever interacted with the first one directly? And a bonus question, do you have the word "AI Product Expert" or "AI Engineer" in your bio? If your answers are no and yes, I don't blame you, but please consider how this may negatively impact your learning over time.

## Pragmatic Principles For Better LLM Results

A large language model takes in tokens and returns a result representative of higher order reasoning, whose quality is dependent on its training (volume and nature of dataset). There is a max number of tokens that an LLM can interpret referred to as the context window. Larger LLMs take a huge amount of resources to run. Once an LLM is trained, it's currently impossible to re-train it

You can read much better academic overviews of LLMs, but above is a baseline to set the stage for TODO TODO There are a some higher-level concepts I think developers need to pay attention to here when it comes to maximize their ability to leverage LLMs to solve problems:

- LLM Output Quality Mirrors Input Quality
- Context Window Size is Positively Correlated With Output Quality
- Quickly Determining External Confidence of LLM Output
- The Cons of agentic AI

# LLM Output Quality Mirrors Input Quality

Anthropic has written a great report on this that is much more eloquently written, if you'd like to read: https://www.anthropic.com/research/economic-index-primitives.

I will summarize my observations here much more simply. The phrase "garbage in, garbage out" has been commonly applied to LLMs, but in reality it's more like "quality of input in reflects quality of input out". It applies at every single level of input quality, from garbage to diamond. The right LLM will produce a beautiful result given a beautiful input. The challenge is, the bar for what constitutes a beautiful result is limited by the end user's ability to discern that, which becomes problematic given how accessible prompt writing is.

I'll make a vibe coding analogy to prove the point here. Non-technical people are amazed at how easy it is for them to produce a working technical output. Fast forward to them "vibing coding", and the next thing you know there are 10,000 codebases that bring to life semi-working startups at an "Uber for Dogs" level of value. Given the mirror that LLMs provide between input and output quality, this becomes a viscious cycle fast.

There is a ton of value in using LLMs to rapidly prototype a semi-realistic output, as long as you recognize that is what you're doing. It may behoove vibe coding laypeople to stop and consider for a moment -- that while the result may seem impressive to them, a true domain expert may instead start by prototyping on a whiteboard, then apply an LLM in a more precise way to achieve a much more valuable result at a fraction of the cost.

# Context Window Size is Positively Correlated With Output Quality

This is somewhat implied in another great Anthropic article here: https://www.anthropic.com/engineering/code-execution-with-mcp, though this time I will make assumptions based on my observations that go beyond what is written there.

The more tokens you give an LLM, the harder of a time it has to interpret those tokens in a way that returns the best result for you. This is really the core principle behind agentic AI. We maintain context outside of the LLM context window, and use that context to open new context windows to ensure that the quality of result remains high.

Don't take my word for this one because it's very easy to observe with your own experiments. I encourage you to pick your favourite LLM product and experiment with asking it the same things at different length of chats. I would also suggest that with the top LLM products on the market today, it is almost always possible to one-shot (or 2-3 shot) a result, and that result significantly cheaper to attain and more valuable. See examples at the end for how you may consider going about this.

# Quickly Determining External Confidence of an LLM Output

I have many thoughts on how determinism and external confidence apply to pragmatic LLM usage. I'll share these thoughts by experiments in later posts. For now, I will plant a seed.

As an expert end user piloting an LLM in the context of their expert domain, it is possible to predict the quality of its output without much effort, often just by skimming through how responses are formatted. For example, Javascript is something I have spent a significant part of my life to mastering, which I hope is evidenced by the scale of this project and how quickly it came together. Almost 100% of the code here was written through manual chats with Gemini 3 Pro... with the exception of a few regrettable commits by default vscode agents.

When Gemini 3 produces good Javascript output, it will mirror the formatting of the rest of my project, and look how I'd expect Enterprise-grade open source Javascript code to look. The comments will be precise and concise. It will apply advanced programming techniques without me having to tell it to explicitly.

When Gemini 3 produces bad Javascript output, everything about how the output is formatted will become less precise. Its code comments will start to add emphasis that is not semantic, it will inject random icons and other formatting in places, and everything will feel less consistent.

It is very difficult to make this distinction as a layperson, however I can guarantee you that Google and all of the other multi-billion dollar LLM product providers are getting very good at determining external confidence, so much so that hallucination is likely no longer a factor when piloting LLMs correctly.

When approaching LLMs with an engineering mindset, then their probabilistic nature is simply something we must design our solutions around, not an absolute constraint. If you don't buy this, please consider this example: (TODO: LINK TO GOLDEN EXAMPLE 1a). The others in the same section may be valuable for you to look through as well.

# The Cons of Agentic AI

I will preface this by saying that there are many pros to agentic AI, especially when applied at the enterprise level. If you are considering development from an enterprise perspective, there is much more nuance here. This section is intended to provoke thought as to why agentic AI may not be the right approach for you, as an individual, to be taking -- especially when almost everyone seems to be on this train.

- Polluting Critical Domain Context

The application of an AI agent to writing code may create a viscious cycle that pollutes your domain context, which in turn makes it harder for the next LLM to get the right result, which may eventually leave your codebase in a hole where starting over is a better approach than continuing.

I'll give you an example from this codebase. Early on, I experimented with using both Gemini 3 Pro and some Agentic AI tools. The Agentic AI tools were impressive but terrifying at the same time, not to mention slower and more expensive.

Consider what happens when asking an LLM-based coding agent to perform a task. It is not designed to execute just one task, but instead to use that prompt to infer something and suggest the next 5 tasks that you chould execute, ad nauseum. It is very hard to resist temptation and tell the agent to stop because task 2 of 5 is the only one that is truly relevant to your domain. The code produced by the other tasks will still work, which is impressive, but it will also add mental overhead to future LLMs and humans working on the code in the form of debt. Every single line of code is debt and unnecessary abstractions make your code less flexible, which is often synyonmous with less scalable.

Excessive use of AI agents, outside of enterprise context, has high risk of reducing the potential value that your project provides.

- Preventing Foundational Learning

The meta abstraction of using an AI agent, rather than a base LLM or LLM-based product, means that you will have less opportunity to learn experientially about the technology.

Consider that the output of what you are doing today, in absolute terms, is likely much less important than building a foundation of knowledge on LLMs to apply tomorrow. If you feel that popular publicly available agentic AI tools produce much better results than you could hope to achieve without them, then that may be even more reason for you to stop using them and start experimenting more directly with LLMs to build your foundation of knowledge.

It is not that hard to build AI agents. Instead of racing to see how many agentic AI compute cycles you can spin up, perhaps instead spend some time browsing through the source code of OpenSpec, or another popular agentic tool of your choice. Fork the repo and ask Gemini or your favourite LLM-product to help you summarize then re-create it. Use that on your personal projects and try making tweaks for better results. You may be surprised how much more you will learn by doing this, and perhaps even that the end result may not be as bad as you think.

- Producing Generally Worse Results

I view agentic AI as a paradigm that allows you to scale usage of LLMs to get many people working together to solve a problem. Consider starting a project in a world not too long ago without AI tools. If the first thing you did was beef it up to be "enterprise-ready" rather than focusing on implementing your core domain logic, then that would universally be viewed as a mistake. This is what AI agents will do indiscriminately unless you are incredibly careful about how you pilot them.

The best approach for an individual or small group working on a codebase is the one that aligns best with their mental model. The way someone else has designed an agentic AI workflow is unlikely to be that for you. It is almost guaranteed to to add a subtle layer of misdirection that negatively impacts your development experience and results.

## Experiments For Engineers

I believe that technologists would benefit more from experimenting with base LLMs directly, models with no magic under the hood, rather than LLM-based products that most are using. Consider what LLM-bassed products are actually doing.

# The Magic Behind Multi-billion Dollar LLM Products

Claude, Gemini and ChatGPT are examples of products built on top of LLMs worth billions of dollars. When you submit a query to a multi-billion dollar product like this, the actual behind the scenes is very different from how LLMs behave at a baseline. At a high-level, you can imagine the request processing flows of these products to be something more like this:

- Parse Input (determine what type of response the user is looking for, and extract key pieces of domain information)
- Inject Additional Context (summarize some other external knowledge repository to add context to the prompt)
- Query Internal LLM With Enriched Context (input the user's query to an internal LLM with enriched user context, plus additional internal magical context not visible to us)
- Verify External Confidence (this can be multiple forms of confidence, such as is the user doing something malicious, or is the answer correct so far)
- Summarize Result (this simulates a "thought process" as results are summarized in chunks and displayed back in the front-end)
- Repeat (ad nauseum)

I'm not going to spend much more time on this because I don't have any actual visibility into how these billion-dollar products function beyond my surface insight. The point is to illustrate that there is so much magic behind the scenes here that it is not a good way to build a foundation of learning, which is what will actually help you grow and better interact with these machines (or even build your own!) in the future.

# Suggested Experiments

Spin up some of your favourite base LLMs with default settings. I recommend Qwen, Llama and phi as a starting point. Here are some experiments you can do to start building a foundation of context and experiential knowledge with LLMs.

After each experiment, note down your observations. What does the distribution of results? How is this different from past results? Can you start start to see or predict any future trends?

- Execute the same one-shot prompt many times in a row against the same model.
- Execute this prompt against other models, or models in the same family of different sizes.
- Create a few simple higher level reasoning tasks that are difficult to solve with traditional programming techniques (perhaps look to open source benchmarks for inspiration). Execute those many times against a variety of models.
- Execute prompts with multiple shots by feeding the results of earlier prompts back into the LLM. Run the same series of prompts many times in a row as well with different models.
- Play around with the size of the context window and execute the same one-shot prompts while the LLM has varied context loaded up.
- Try to trick the LLM in as many different ways as you can, subtle or not so subtle. Play around with adding references to irrelevant domain concepts or objects, like a layperson might, and run these prompts many times against a variety of LLMs.
- Summarize the results of your chain of prompts with another LLM to replicate the "thinking" loading bar that LLM-products show.

The only tricky thing about running these experiments is getting access to base models larger than a certain size due to hardware requirements. If anyone would like to collaborate on setting this up, I have many ideas for a learning sandbox that I'd love to contribute.

## Examples From my Personal LLM Usage

All the code you see here to date was written entirely by chatting manually (copy / pasting) with Gemini 3 Pro over the course of a few days. I got better at it over time, but I applied the same principles from the beginning.

I never considered my interaction to be a chat, instead I always tried to carefully consider what context window Gemini was working with and what I was trying to do. I also never vibe coded. I spent a bunch of time in debugger breakpoints analyzing and copying (later memoizing) large data structures created by my app or returned by the Gemini Batch APIs so both the LLM and I could understand them. At the start of each session, I spent some time ramping up my own mental context as to what I wanted to do next and where I left off while sipping coffee and lightly cleaning up code.

The point I'm trying to make, is that this wasn't vibe coding, but it also wasn't agentic AI either. Do we have a term that describes using LLMs as a precise tool piloted by experts to amplify (not just reproduce) results? Maybe this would be a good place to start.

# Applied Principles Behind This Codebase

There are a handful of things I did intentionally while developing that worked out well.

- No markdown files or unnecessary formatting (such as headers) passed to LLM.

Instead, I focused on keeping my code as semantic as possible, and gave the LLM only brief handwritten prompts that referenced certain files or methods along with concise higher order instructions.

- No files unrelated to my domain such as configuration.

There is a utility file called `packageCodeForLlm` at root of this codebase. My workflow involved running this script to strip all irrelevant or dangerous context before uploading all project files to the LLM in my initial prompt.

- Limited use of libraries.

This was partly to experiment, but the results were surprisingly good. I only used stuff as ubiquitous as a web server to avoid hidden context. I did import the Gemini SDK, which was a mistake in hindsight as manually constructing requests would have been more effective.

- Write pure code that supports memoized datastructures.

I developed functionality in chunks generally running an orchestration method and saving the results of it to a file either manually or later with memoization. The LLM was able to flawlessly handle any external context with this approach. It's also generally good practice when working with an interpreted language like JS.

Side note: I have seen some industry benchmarks of LLMs ability to produce code in various languages. Generally, interpreted languages score much lower than compiled languages. I can guarantee that these benchmarks are not taking advantage of the real benefit of using an interpreted language, where something like memoization is trivial to do.

- Ask Gemini to produce full file responses to all my prompts.

I started with more of a bottom-up approach and focused on methods. LLMs are not a bottom-up tool. Having Gemini produce full files, even if I was making a tiny change to one method in the file, always worked better than me having to wrangle individual methods or lines of code. One thing I was careful of was asking it to make these small changes with too big of a context window loaded, as this would increase chance of random refactoring rather than precise outputs.

- Consider what context LLM has carefully in each interaction.

I would stick with one chat for efficiency if the context was still relevant, or if my request for the LLM was trivial enough for it to not matter. As soon as I jumped to a new feature requiring different higher order context, or if my chat got too long, I would create a new oen and start over again.

## Gemini 3 Pro Chat Examples

NOTE: all code input in examples is my full project stripped of irrelevant context. By the last prompts, this was ~95 files. Always manually uploaded, never linked to a repo.

# Refactor Core Prompt Generation Logic

https://gemini.google.com/share/1a1fdb177658
TODO: Add commit link (after uploading)

My initial one-shot prompt was probably too verbose, but this file is so critical to the project that I described it more than I did others.

What's really interesting is that my first attempt tripped Gemini's external confidence meter and it returned `Sorry, something went wrong. Please try your request again.` after flashing some internal method call gibberish. I have only been able to get this a few times after longer chats previously.

Previous times I got this, re-running the prompt returned the same result, so I analyzed my prompt for any logic input errors and updated exactly two words from the input: `I'd like the new file to have two methods.` -> `I'd like the new file to have the following methods.`

As you can see, it then did a beautiful job of refactoring the file.

What's also really interesting is how Gemini responded to the rest of the chat. I had a few other simple things I wanted it to do to this file, namely refactor the input data structure (next prompt). It performed so badly on the next two prompts, completely missing context behind what would have likely been easy one-shots with a fresh context.

# Refactor Prompt Generation Data Structure Input

https://gemini.google.com/share/e394d1e6c1a2
TODO: Add commit link

A clean example of what I mean by memoization and the advantages of interpreted languages with LLMs. Gemini did a great job refactoring in the previous example, but it made up the data structure of the input. A simple example object and 3 sentences resulted in beautiful Javascript code. I was getting lazy by this point, this was my last commit of the day, so I just pasted a reference into the file itself.

# Refactor Core Service

https://gemini.google.com/share/eb623065066f
TODO: Add commit link

# Create Helper Script to Upload Files to LLM

https://gemini.google.com/share/71041e15531e
TODO: Add commit link

# Feature: Serve Web Components from Prompt Responses

https://gemini.google.com/share/7fa5ed003d78
TODO: Add commit link

# Feature: Generate Prompts from DB State

https://gemini.google.com/share/e63f086ac0f8
TODO: Add commit link

# Multiple Complex Front-end Features in One Chat

https://gemini.google.com/share/816018a113b9
TODO: Add commit link
