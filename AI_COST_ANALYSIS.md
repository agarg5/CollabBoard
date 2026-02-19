# AI Cost Analysis — CollabBoard

## Part A: Development & Testing Costs

### Claude Code (Anthropic API) — Primary Development Tool

| Metric | Value |
|--------|-------|
| **Total development time** | ~2.5 days (Feb 16–18, 2026) |
| **CollabBoard sessions** | ~28 dedicated sessions |
| **Commits produced** | 167 |
| **Estimated API calls** | ~2,000+ (code generation, editing, search, analysis) |
| **Estimated tokens consumed** | ~15M input / ~5M output |
| **Estimated cost** | ~$80–120 (Claude Opus for complex tasks, Sonnet for routine) |

*Note: Claude Code usage is billed through the Anthropic Max subscription plan, which includes a usage allowance. Exact token-level billing is managed by the subscription. Session count from Claude Code Insights report.*

### OpenAI GPT-4o — AI Board Agent (Production Feature)

Tracked via **LangSmith** observability (3 traced runs during testing):

| Metric | Value |
|--------|-------|
| **Total API calls** | 3 (testing phase) |
| **Input tokens** | 9,414 |
| **Output tokens** | 99 |
| **Total tokens** | 9,513 |
| **Model** | gpt-4o |
| **Cost per 1K input tokens** | $0.0025 |
| **Cost per 1K output tokens** | $0.01 |
| **Total OpenAI testing cost** | ~$0.024 |

### OpenAI Moderation API

| Metric | Value |
|--------|-------|
| **API calls** | 3 (one per AI agent request) |
| **Cost** | Free (Moderation API has no charge) |

### Other AI-Related Costs

| Item | Cost |
|------|------|
| Supabase (hosted backend) | Free tier (sufficient for dev/testing) |
| Vercel (frontend hosting) | Free tier |
| LangSmith (observability) | Free tier |
| **Total other costs** | $0 |

### Total Development Cost Summary

| Category | Cost |
|----------|------|
| Claude Code (Anthropic) | ~$80–120 (subscription-based) |
| OpenAI GPT-4o (AI agent testing) | ~$0.02 |
| Infrastructure | $0 (free tiers) |
| **Total** | **~$80–120** |

---

## Part B: Production Cost Projections

### Assumptions

| Parameter | Value |
|-----------|-------|
| Average AI commands per user per session | 5 |
| Average sessions per user per month | 8 |
| AI commands per user per month | 40 |
| Average input tokens per command | ~3,200 (system prompt + board state + history) |
| Average output tokens per command | ~100 (tool calls + response) |
| Average tool call iterations per command | 1.5 (some commands need multi-step) |
| OpenAI API calls per command | 1.5 (accounting for multi-step) |
| Moderation API calls per command | 1 (free) |

### Token Usage Per Command

| Component | Input Tokens | Output Tokens |
|-----------|-------------|---------------|
| System prompt | ~900 | — |
| Board state (avg 20 objects) | ~800 | — |
| Message history (last 5 messages) | ~500 | — |
| User prompt | ~50 | — |
| Tool definitions | ~950 | — |
| Model response | — | ~100 |
| **Total per command** | **~3,200** | **~100** |

### GPT-4o Pricing (as of Feb 2026)

| Token Type | Cost per 1K Tokens |
|------------|-------------------|
| Input | $0.0025 |
| Output | $0.01 |

### Monthly Cost Projections

| Scale | Monthly AI Commands | Input Tokens | Output Tokens | OpenAI Cost | Supabase | Vercel | **Total** |
|-------|-------------------|-------------|---------------|-------------|----------|--------|-----------|
| **100 users** | 4,000 | 12.8M | 400K | **$36** | Free | Free | **~$36/mo** |
| **1,000 users** | 40,000 | 128M | 4M | **$360** | $25 (Pro) | Free | **~$385/mo** |
| **10,000 users** | 400,000 | 1.28B | 40M | **$3,600** | $25 (Pro) | $20 (Pro) | **~$3,645/mo** |
| **100,000 users** | 4,000,000 | 12.8B | 400M | **$36,000** | $599 (Team) | $150 (Enterprise) | **~$36,750/mo** |

### Cost Optimization Strategies

At scale, several strategies would significantly reduce costs:

1. **Model downgrade for simple commands**: Use GPT-4o-mini ($0.00015/$0.0006 per 1K tokens) for simple creation commands. ~70% of commands are simple, reducing OpenAI costs by ~60%.

2. **Board state compression**: Instead of sending full JSONB, send a summary (object count by type, bounding box). Reduces input tokens by ~25%.

3. **Prompt caching**: Cache the system prompt + tool definitions (1,850 tokens) across requests. OpenAI prompt caching gives 50% discount on cached tokens.

4. **Rate limiting**: Cap AI commands per user (e.g., 50/day on free tier, unlimited on paid). Prevents abuse and controls costs.

5. **Response streaming**: Doesn't reduce cost but improves perceived latency, reducing retry/abandon rates.

### Optimized Cost Projections (with strategies 1–4)

| Scale | Estimated Monthly Cost |
|-------|----------------------|
| **100 users** | ~$15/mo |
| **1,000 users** | ~$170/mo |
| **10,000 users** | ~$1,500/mo |
| **100,000 users** | ~$15,000/mo |
