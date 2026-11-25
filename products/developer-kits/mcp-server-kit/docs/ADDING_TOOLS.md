# Adding a tool

## 1. Create the tool

`src/tools/word-count.ts`:

```ts
import { z } from "zod";
import { defineTool } from "../registry.ts";

export const wordCount = defineTool({
  name: "word_count",                 // lowercase, digits, underscores
  title: "Word count",
  description: "Count words and characters in a piece of text.",
  input: z.object({ text: z.string().max(100_000) }),
  handler: ({ text }) => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { text: JSON.stringify({ words, characters: text.length }) };
  },
});
```

## 2. Register it

In `src/config.ts`, add `.register(wordCount)` inside `buildRegistry`.

## 3. Test it

Call handlers through the registry so validation is exercised too:

```ts
const reg = new ToolRegistry().register(wordCount);
assert.deepEqual(await reg.call("word_count", { text: "a b c" }), { text: '{"words":3,"characters":5}' });
assert.equal((await reg.call("word_count", { text: 42 })).isError, true);
```

## Guidelines

- **Describe the tool for the model.** The `description` and the zod `.describe()` texts are what the AI client sees. Be specific about inputs and limits.
- **Return text the model can use.** JSON strings work well for structured results.
- **Mark side effects.** Set `sideEffects: true` for anything that writes, sends or calls the network.
- **Validate, then act.** Never trust arguments; the registry validates shape, and your handler should check business rules.
- **Fail with a message.** Throw an `Error` with a clear message; the registry converts it into an MCP tool error.
- **Keep secrets in env vars.** Read them in `config.ts` and pass them into tool factories, as `createHttpGet` does.
