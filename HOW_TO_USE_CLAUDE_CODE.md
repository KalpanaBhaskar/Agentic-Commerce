# How to Use Claude Code for RazorAgent
## A first-timer's complete guide

---

## Step 0: Install Claude Code (one time)

```bash
npm install -g @anthropic-ai/claude-code
```
Verify: `claude --version`

Requires: Node.js 18+, an Anthropic API key set as `ANTHROPIC_API_KEY` in your shell environment.

---

## Step 1: Start your project repo

```bash
mkdir razoragent && cd razoragent
git init
git remote add origin https://github.com/YOUR_USERNAME/razoragent.git
```

Copy `CLAUDE.md` into the root of this repo. This is the first thing Claude Code reads.

---

## Step 2: How Claude Code works (mental model)

Claude Code is a terminal agent. You run `claude` in your project directory,
and it can read/write files, run shell commands, and run tests — all in your codebase.

**Think of it as:** a senior dev sitting next to you who can type faster than you.
You tell it WHAT to build. It figures out HOW. You review the output and approve.

Key commands inside a Claude Code session:
- Just type your request in plain English
- `ctrl+c` to interrupt if it goes off track
- `/clear` to reset context if it gets confused
- `/exit` to end the session

---

## Step 3: Session template (use this EVERY time)

At the start of EVERY Claude Code session, paste this exact message:

```
Read CLAUDE.md completely before doing anything.

I am building Feature N: [feature name]
Branch: feat/0N-feature-name

Context: [any relevant state, e.g. "Feature 1-3 are complete and merged. 
The server runs on port 3000. Webhooks are working."]

Task: [describe exactly what you want built this session]

Constraints:
- Do not modify files outside this feature's scope
- Every money action must call audit logger
- No hardcoded API keys
- Write the code, then tell me how to test it
```

---

## Step 4: Feature-by-feature workflow

For each of the 8 features:

### 4a. Create the branch
```bash
git checkout -b feat/01-scaffold-catalog
```

### 4b. Start Claude Code
```bash
claude
```

### 4c. Paste the session template with the specific feature details

### 4d. Review what Claude Code writes
- Read every file it creates/edits
- If something looks wrong, say "stop — explain why you did X" before proceeding
- If it goes off-track, `ctrl+c` and rephrase

### 4e. Test manually
```bash
npm run dev
# In another terminal:
curl http://localhost:3000/catalog
```

### 4f. Run tests
```bash
npm test
```

### 4g. Commit and push
```bash
git add .
git commit -m "feat: scaffold + agent-readable catalog endpoint"
git push origin feat/01-scaffold-catalog
```

### 4h. Open a PR on GitHub
- Title: same as commit message
- Description: what it does, how to test, what audit log shows

---

## Step 5: Where Claude Code spends your credits

**Expensive (uses many tokens):**
- Generating large files from scratch (first session is always the most expensive)
- Asking it to "refactor everything"
- Very long context windows (many files open at once)

**Cheap:**
- Editing one specific function
- Adding tests for existing code
- Fixing a specific bug you've identified

**How to save credits:**
1. Be specific. "Add audit logging to `src/api/razorpay.js` in the `createOrder` function" is cheaper than "add audit logging everywhere."
2. One feature per session. Don't ask it to build Features 1 and 2 together.
3. When it asks a clarifying question, answer it — don't make it guess.
4. If it starts writing something wrong, interrupt immediately (`ctrl+c`) — don't let it write 200 lines of wrong code.
5. Review generated code BEFORE asking for the next thing.

---

## Step 6: Red flags — when to interrupt

Interrupt (`ctrl+c`) immediately if Claude Code:
- Starts installing packages you didn't ask for
- Creates files in directories you didn't specify
- Starts modifying `.env` with real API keys
- Writes more than ~100 lines without you reviewing
- Starts building something from a different feature

---

## Step 7: The ngrok workflow (Feature 3+)

You need TWO terminals running simultaneously:

```bash
# Terminal 1 — always running
npm run dev

# Terminal 2 — for webhook testing
ngrok http 3000
# Copy the https URL
# Set it in .env as NGROK_URL
# Set it as webhook URL in Razorpay dashboard
```

Every time ngrok restarts, you get a new URL. Update `.env` and Razorpay dashboard.

---

## Step 8: Testing Razorpay webhooks

In Razorpay dashboard → Webhooks → your webhook → "Send Test Event"
Choose event: `payment.captured` or `payment.failed`

Or trigger manually via test payment:
1. Create order via `POST /orders`
2. Open payment link in browser
3. Use test card: `4111 1111 1111 1111`, any future expiry, CVV `123`
4. For failure: `4000 0000 0000 0002`

---

## Step 9: GitHub PR workflow

```bash
# After completing a feature:
git add .
git commit -m "feat: [feature name]"
git push origin feat/0N-feature-name

# On GitHub.com:
# New Pull Request → base: main ← compare: feat/0N-feature-name
# Fill in description
# Merge after self-review
```

Never push directly to main. Every feature goes through a PR.

---

## Step 10: When to use Claude.ai (this chat) vs Claude Code

| Use Claude.ai (here) | Use Claude Code (terminal) |
|---|---|
| Planning, architecture decisions | Writing actual code |
| Debugging a concept | Running and fixing tests |
| Understanding Razorpay API behavior | Creating/editing files |
| Reviewing PR descriptions | Refactoring specific functions |
| Preparing demo narrative | Setting up package.json |

---

## Plugins/Connectors/Skills — When to Use Them

**Claude Code Skills (SKILL.md files in your repo):**
These are NOT Claude.ai skills. In this project, you'll create 3 SKILL.md files
in the `skills/` directory. They teach the Claude agent (running inside your app)
how to do specific workflows. Build them in Feature sessions 4-5.

**Claude.ai connectors (GitHub):**
If you connect GitHub to Claude.ai, you can ask Claude.ai to review your PRs
or explain diffs. Useful for code review after each feature.

**Claude.ai connectors (Google Drive/Docs):**
Useful for storing your demo script, judge prep notes, architecture diagrams.

**Do NOT use Claude.ai connectors for:**
- Writing the actual code (use Claude Code for that)
- Calling Razorpay APIs directly (your Node.js app does that)

---

## Emergency: If Claude Code produces broken code

1. `git stash` — preserve Claude's work but revert working tree
2. Come back to Claude.ai (here), paste the broken file, explain what's wrong
3. Get a fix strategy, then go back to Claude Code with the specific fix
4. `git stash pop` and apply the fix

---

## Session log format (paste in docs/PROMPTS.md after each session)

```markdown
## Session N — [Date]
**Feature:** Feature N: [name]
**Branch:** feat/0N-name
**Session prompt:** [paste your opening prompt]
**Outcome:** [what was built]
**Tests passed:** yes/no
**PR:** #[number]
**Notes:** [anything surprising, decisions made]
```
