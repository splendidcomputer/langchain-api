## Frequently Asked Questions

### What are tools in LangChain?

LangChain supports packages that contain module integrations with individual third-party providers, known as "tools." These tools can be as specific as `@langchain/anthropic`, which contains integrations exclusively for Anthropic models, or as broad as `@langchain/community`, which includes a variety of community-contributed integrations. These packages, along with the main LangChain package, all depend on `@langchain/core`, which contains the base abstractions that these integration packages extend.

### What are agents in LangChain?

Agents in LangChain are systems that use a language model as a reasoning engine to determine which actions to take and what the inputs to those actions should be. These systems can interact with multiple different tools, such as a local database and a search engine, and can be used to ask questions, call tools, and have conversations. When building with LangChain, all steps are automatically traced in Lang
