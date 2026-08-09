# NexCode Feature Checklist

Last reviewed: 2026-08-09

## Completed

- [x] Provider-independent LLM gateway
- [x] Local provider
- [x] Cohere provider
- [x] OpenAI-compatible API provider
- [x] Configurable LLM model, API key, and base URL
- [x] Non-streaming `/explain` route
- [x] Non-streaming `/generate` route
- [x] Non-streaming `/fix` route
- [x] Non-streaming `/review` route
- [x] Non-streaming `/complete` route
- [x] Non-streaming `/test-complete` route
- [x] Generic `/ai` route
- [x] Backend streaming routes
- [x] VS Code inline completion provider
- [x] Explain, fix, and review code actions
- [x] Project generation command
- [x] Project file parser
- [x] Three-stage pipeline
- [x] Early pipeline failure handling
- [x] Python Docker sandbox execution
- [x] GitHub branch and pull request creation
- [x] Pipeline scan route
- [x] Pipeline status route
- [x] Pipeline pull request route
- [x] Backend route tests
- [x] Backend Python compilation

## Partial Or Needs Hardening

- [x] Inline completion debounce
- [x] Inline completion context truncation
- [x] Inline completion enable/disable setting
- [x] Extension streaming client and SSE parsing
- [x] Generate command replacing selected editor content
- [x] Project parser path traversal protection
- [x] Strict project response validation
- [x] Sandbox execution for non-Python languages
- [x] Loading pipeline standards from `nexcode.config.json`
- [x] Loading GitHub and deployment configuration from `nexcode.config.json`
- [ ] Extension integration with pipeline routes
- [ ] Pipeline result notifications in VS Code
- [ ] Durable pipeline job storage
- [ ] Production queue workers
- [ ] Extension bundling and packaging configuration

## Not Implemented

- [ ] Reachable MCP-driven pipeline integration
- [ ] Vercel deployment integration
- [ ] Celery workers
- [ ] Redis-backed pipeline queue
- [ ] Registered keyboard shortcuts
- [ ] Registered pipeline command in the extension
- [ ] Extension automated tests

## Validation

- Backend test suite: **11 passed**
- Backend compilation: **passed**
- Extension automated test coverage: **not available**
