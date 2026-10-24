# Terminal Value

Source for [terminalvalue.net](https://terminalvalue.net), where I write about AI engineering for humans and agents.

The blog is being rebuilt. For now, `site/` holds a temporary holding page.

## Projects

- [**Terminal Value pipeline**](./projects/terminal-value-pipeline/) (Feb 2026): an early "transactional AI" experiment. An LLM pipeline takes a base web component and CRM notes about a customer, and generates a personalized home page for that customer in a mock ski shop. Every page is generated in one shot, using about 10k tokens.

## Deploy

The site is hosted on Cloudflare Pages, in the `terminal-value` project.

```sh
npx wrangler@4 pages deploy site --project-name=terminal-value --branch=production
```

## License

[MIT](./LICENSE.txt)
