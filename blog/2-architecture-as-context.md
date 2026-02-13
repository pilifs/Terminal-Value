# Architecture as Context

-- FIRST DRAFT BELOW, NOT PROOFREAD

Architecture as code is a commonly held principle that dictates the semantics of your code should reflect your architecture intent. Every decision you make in code, i.e., folder structure, design patterns, frameworks, language, etc. should align as much as possible with your architectural design principles. This naturally creates guardrails and an organic semantic layer that empowers people by enabling them to focus on code rather than external artifacts. It also grounds your architecture in something tangible, avoiding ivory tower situations. This is a driving principle behind "Domain Driven Design", one of the most popular digital architecture philosophies of modern software development.

Consider the widely held belief that most code will be written by an LLM in the future. Context is the most important ingredient to getting an LLM to produce a code response. Therefore, we must in turn shift our thinking away from architecture as code to **"Architecture as Context."**

## Architecture as Context as Code

There is a small paradox in the closing statement of the last section. Most of the context you give to LLMs will still be as code, therefore code is still relevant. The difference now is that this code must be designed to invoke a good LLM response, as opposed to being designed for large groups of human contributors.

This is where most prompt engineering advice you find online, whether through tradional search or asking your favourite LLM-product, is flatout wrong. Your typical prompt engineering article dictates that you describe what you want the LLM to do in a list of tasks that is formatted as a typical project management task list.

Tasks do not provide value to your business. This is the antithesis of every scaled approach to building products: domain-driven design, vertical teams, flat org structure, etc. If your prompt is formatted like a list of tasks, and that is your input to the LLM, then your code is more likely to come out oriented around a list of tasks, and not your business domain. The next time you feed that code back into an LLM to make changes, it will create a viscious cycle moving your code further away from your business logic and more towards expression as generic methods.

One day, you will have a killer new feature that you need to implement fast. By this time your codebase is big enough that the AI outputs will drift more and miss context occasionally. You write the world's best prompt and put it alogside your code. By this point, there is so much code that the prompt is less important as the LLM is inferring context from code.

The LLM returns a subtle bug in business logic, but the code still works. This is shipped to production and causes a customer to lose money. You could shout "hallucination" into the sky aimlessly, or consider the following.

You had a chance to bias your context toward domain intent a while ago. Instead, you were doe eyed by the speed at which your agentic network was able to churn through tasks. If your code was more domain semantic, it's more likely the LLM would have drifted to somewhere harmless, such as making a poor comment, rather than failing at writing good code. Your lack of care in representing your domain architecture in your context caused you to lose money because your LLM drifted towards negatively impacted your business instead.

## Architecture as Agentic AI

Conway's Law dictates that your org structure is the biggest predictor of your resulting architecture. In other words, communication pathways between people is the biggest influence the structure of your software solutions. Your best engineers are motivated by solving problems with technology. If it's too hard to communicate and align on a solution with their peer across the org, they will design interfaces that minimizes this friction, whether consciously or not.

This is one of the most important principles of modern scaled software development. It's why we organize our teams in verticals and journeys -- to allow the domain to shine through in solutions. This principle applies to agentic AI too, but in a slightly different way. Agents are not limited by communication. They are limited by how you configure them.

Let's imagine that you have three AI agents working on your codebase. Each has context that biases them towards a specific function: features, clean up, and tests. Should these agents ever collide in a codebase?

Counter-intuitively, no they should not, unless you really understand what you are doing with context. Different agentic AI personas working on the same code

## Architecture as Tests

To be blunt, bottom-up testing (i.e., unit tests) is largely irrelevant in the world of LLMs. LLMs are top-down systems, not bottom-up systems. If you are only doing bottom-up testing yet your top-down systems are producing the code, then what are the tests for?

If you must have tests, then you should write top-down tests, such as integration tests. Adding unit tests only weakens your context, which will make it harder for LLMs to write new code or waste agentic cycles. Consider that the purpose of tests are to prevent bugs from being committed. If your context is good, you are much less likely to ever hit a bottom-up logic bug in the first place anyway.

The other problem with traditional software testing in a world of LLMs is that it does not verify the failure modality that is most likely to occur, which is the LLM not interpreting the prompt correctly, but still producing working code. This is why the industry standard is cross-functional teams and quality owned by every individual. Counter intuitively, your tests are likely better off being externalized to match how LLMs work and produce code, not sit right next to your business logic.

Your tests must also be written with probablistic, not deterministic, code generation in mind. This is a much larger topic I will touch on in the next article.

## Contextual Debt

There are many large codebases today that were written for human consumption, not LLM consumption. These codebases are therefore likely to be much harder for LLMs to interpret contextually and work on. It is widely hypothesized that most code will be written by LLMs in the future.

This means that, overnight, your code carefully designed to minimize technical debt, now carries significant **"Contextual Debt.** Your agents are working much harder than they could be to interpret this legacy code, costing you money in the form of compute cycles. Your features are produced more slowly and less likely to be true to their intent. You require much more expensive models to interpret your code. These models are larger than you are able to run internally, therefore you are potentially compromising your data.

As a thought experiment, should you carefully re-write your systems with the right LLM-product or Agentic AI tool to reduce contextual debt? In spirit, the question comes down to how much it will cost you (in risk, time, or actual dollars) to achieve feature parity versus the opportunity cost of not doing so. In practice, unless you are a single developer, this is much more complicated as there are many other negative implications to taking a big bang approach.

A simple yet powerful principle that works well in this situation is instilling the mindset of "leave it better than you found it" in your developers when it comes to how they approach modifying code and the debt inherent in that. Hopefully the article above will help you consider how you can leave your existing systems better than you found them by keeping architecture as context in mind.

## Demo / Example

My first article was written from an engineering perspective with examples showcasing how to write code with an LLM. Let's scale this to bias it towards architecture and look at how to produce systems that produce some novel value with an LLM.

I was planning to produce a bunch of user personalized views for the ski shop here. I will still do that, but I thought an interactive example would be something more interesting -- thus, the small business app generator was born.
