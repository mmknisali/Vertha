# Contributing

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## Code Style

### Python

- Use `snake_case` for functions and variables
- Use `PascalCase` for classes
- Maximum line length: 100 characters
- Use type hints where helpful
- No unnecessary comments — code should be self-documenting

### JavaScript/React

- Use `camelCase` for variables and functions
- Use `PascalCase` for React components
- Prefer functional components with hooks
- Use early returns to reduce nesting
- Maximum line length: 100 characters

### General

- No TODO/FIXME comments — file issues instead
- No commented-out code — delete it
- No debug prints — use proper logging
- No magic numbers — use named constants

## Commit Messages

```
feat: add web search caching
fix: silence detection timeout on long utterances
docs: document PC control endpoints
refactor: simplify emotion detection keywords
```

Use imperative mood: "add" not "added", "fix" not "fixed".

## Pull Request Process

1. **Title:** Clear, concise description of the change
2. **Description:** Explain what and why, not how
3. **Tests:** If adding a feature, add tests. If fixing a bug, add a regression test.
4. **Docs:** Update relevant documentation
5. **CI:** Ensure all checks pass

## Areas Needing Help

- [ ] Session summarization via LLM
- [ ] Better wake word accuracy
- [ ] Calendar integration
- [ ] Local LLM option for privacy
- [ ] Wayland support for PC control

Check the [issue tracker](https://github.com/mmknisali/vertha/issues) for more.

## Reporting Issues

- Search existing issues first
- Include reproduction steps
- Include system info (distro, Python version, Node version)
- Include relevant logs (sanitize secrets)

## Questions?

Open a discussion at https://github.com/mmknisali/vertha/discussions
