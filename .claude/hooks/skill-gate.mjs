import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesPath = join(__dirname, "skill-rules.json");

let rules;
try {
  rules = JSON.parse(readFileSync(rulesPath, "utf-8"));
} catch {
  process.exit(0);
}

let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
}

let prompt;
try {
  prompt = JSON.parse(input).user_prompt ?? "";
} catch {
  process.exit(0);
}

if (!prompt) {
  process.exit(0);
}

const promptLower = prompt.toLowerCase();
const matched = new Set(rules.always ?? []);

for (const rule of rules.rules ?? []) {
  try {
    if (new RegExp(rule.match, "i").test(promptLower)) {
      for (const skill of rule.skills) {
        matched.add(skill);
      }
    }
  } catch {
    // skip malformed regex
  }
}

if (matched.size === 0) {
  process.exit(0);
}

const skillList = [...matched].join(", ");
const context = `SKILL GATE (auto-matched from user prompt): Invoke these skills via the Skill tool BEFORE responding: ${skillList}`;

const output = {
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: context,
  },
};

process.stdout.write(JSON.stringify(output) + "\n");
