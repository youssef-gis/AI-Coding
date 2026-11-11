import { run, codex } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);

if (args.length !== 0 && args.length !== 2) {
  console.error("Usage: pnpm sandcastle:run [<prd-file> <plan-file>]");
  process.exit(1);
}

let promptSource: { promptFile: string } | { prompt: string } = {
  promptFile: "./.sandcastle/prompt.md",
};

if (args.length === 2) {
  const [prdPath, planPath] = args;
  const [prd, plan] = await Promise.all(
    args.map((path) => readFile(path, "utf8"))
  );

  promptSource = {
    // Inline prompts are passed through without shell-command expansion.
    prompt: [
      `# PRD (${prdPath})`,
      prd,
      `# PLAN (${planPath})`,
      plan,
      "# INSTRUCTIONS",
      "Explore the repo and implement the next incomplete phase of this plan. Only work on a single phase per iteration.",
      "Run `pnpm run test` and `pnpm run typecheck` before committing. Update the plan file to mark completed acceptance criteria, then commit the implementation and plan updates with a descriptive message.",
      "Read the plan file again at the start of each iteration; it is the source of truth for progress.",
      "If all phases are complete, output <promise>NO MORE TASKS</promise>.",
    ].join("\n\n"),
  };
}

const authPath = join(
  process.env.CODEX_HOME || join(homedir(), ".codex"),
  "auth.json"
);
const auth = await readFile(authPath, "utf8")
  .then((content) => JSON.parse(content))
  .catch(() => null);

if (!auth?.tokens?.access_token || auth.auth_mode !== "chatgpt") {
  console.error(
    "Sandcastle requires a ChatGPT login. Run: codex -c 'cli_auth_credentials_store=\"file\"' login"
  );
  process.exit(1);
}

await run({
  // Use the host's subscription login, even if .env contains an API key.
  agent: codex("gpt-6.1-sol", {
    env: { CODEX_API_KEY: "", OPENAI_API_KEY: "" },
  }),
  sandbox: docker({
    mounts: [
      {
        hostPath: authPath,
        sandboxPath: "/home/agent/sandcastle-auth.json",
        readonly: true,
      },
    ],
    env: { CODEX_HOME: "/home/agent/.codex" },
  }),
  hooks: {
    sandbox: {
      onSandboxReady: [
        {
          // Give Codex a writable copy for token refresh without mounting the
          // host's settings, sessions, or other Codex files.
          command: `mkdir -p /home/agent/.codex && install -m 600 /home/agent/sandcastle-auth.json /home/agent/.codex/auth.json && printf '%s\\n' 'forced_login_method = "chatgpt"' 'cli_auth_credentials_store = "file"' > /home/agent/.codex/config.toml`,
        },
      ],
    },
  },
  ...promptSource,
  maxIterations: 3,
  completionSignal: "<promise>NO MORE TASKS</promise>",
  // Codex reports API failures on stdout as JSON; keep them even when stderr
  // contains only "Reading prompt from stdin...".
  logging: { type: "file", path: ".sandcastle/logs/dev.log", verbose: true },
});
