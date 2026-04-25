# Contributing to claude-for-movies

Thanks for your interest — contributions are welcome.

## Ways to contribute

- **Report a bug:** open a [bug report](https://github.com/JCodesMore/claude-for-movies/issues/new?template=bug_report.md) with steps to reproduce.
- **Request a feature:** describe the use-case first, implementation second. [Open a request](https://github.com/JCodesMore/claude-for-movies/issues/new?template=feature_request.md).
- **Submit a PR:** see below.
- **Help another user:** jump into [Discord](https://discord.gg/babcVNJBet).

## Development setup

```bash
git clone https://github.com/JCodesMore/claude-for-movies.git
cd claude-for-movies/mcp-server
npm install
```

### Load the plugin in Claude Code

From the project root:

```bash
claude --plugin-dir .
```

Inside Claude Code, run `/mcp` — you should see `claude-for-movies` listed with 18 tools.

### Smoke-test the MCP server in isolation

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual","version":"1.0"}}}' | node mcp-server/index.js
```

You should get a single JSON response with `serverInfo.name: "claude-for-movies"`.

## Pull request checklist

- [ ] Changes are scoped — one logical change per PR.
- [ ] Skill `SKILL.md` files stay under ~2,000 words (use progressive disclosure via `references/` or `examples/`).
- [ ] No secrets, API keys, or personal data committed (`.gitignore` covers most of it — double-check anyway).
- [ ] Added / updated `CHANGELOG.md` under the `[Unreleased]` section for user-visible changes.
- [ ] New or modified MCP tools return `{ content: [{ type: "text", text: "..." }] }` on success and `{ content, isError: true }` on failure.
- [ ] Commit messages are descriptive (imperative mood: *"Add trending-by-genre filter"*).

## Code style

- **JavaScript:** modern ESM; `const` by default; run `node --check` if you're unsure about syntax.
- **Skills:** third-person description in frontmatter, imperative voice in body, instructions written *for* Claude.
- **MCP tools:** each tool definition lives in `mcp-server/lib/tools/` and is registered in `mcp-server/index.js`. Keep tool descriptions short and specific — they are what Claude sees to decide when to call them.

## Community & communication

- **Chat:** https://discord.gg/babcVNJBet
- **Issues:** for actionable bugs and scoped feature requests.
- **Discussions:** if you want to propose a larger change, open a Discord thread first so we can align on scope.

## License

By submitting a contribution, you agree your contribution is licensed under the [Apache License 2.0](LICENSE) — the same license as the rest of the project.
