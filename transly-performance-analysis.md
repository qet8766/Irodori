# Transly Performance Analysis

## Problem: 6514ms vs Previous 2000ms

You're experiencing a **3.2x slowdown** (6514ms vs 2000ms). The culprit is likely the **GPT-5.1 API**.

## Root Cause: GPT-5.1 with Reasoning

Even with `reasoning: { effort: 'low' }`, GPT-5.1 is a reasoning model that:
- Performs internal chain-of-thought reasoning
- Has higher latency than non-reasoning models
- Takes 3-6 seconds even on "low" effort for simple tasks

### Expected Timing Breakdown (6514ms total):
```
Fixed delays:    ~500ms  (hotkey release, clipboard waits, paste)
Clipboard poll:  ~50ms   (if text found quickly)
Paste operation: ~100ms  (clipboard write + Ctrl+V)
API call:        ~5900ms (GPT-5.1 reasoning - THE BOTTLENECK)
```

## Solutions

### Option 1: Use GPT-4o-mini (Recommended for Speed)
**Fastest option** - returns to ~2000ms performance:

```typescript
const MODEL = 'gpt-4o-mini'

// Use old API (no reasoning params)
const response = await client.chat.completions.create({
  model: MODEL,
  messages: [
    { role: 'system', content: 'Fix typos. Return ONE corrected word/phrase only. No period.' },
    { role: 'user', content: copiedText }
  ],
  temperature: 0
})
const corrected = response.choices[0]?.message?.content?.trim()
```

**Performance:** ~1500-2000ms total (API: ~800-1200ms)

### Option 2: Use GPT-5.1 with reasoning_effort: 'none'
**Fast GPT-5.1** without reasoning:

```typescript
const MODEL = 'gpt-5.1'

const response = await client.responses.create({
  model: MODEL,
  input: `Fix typos: ${copiedText}`,
  reasoning: { effort: 'none' },  // ← KEY CHANGE
  text: { verbosity: 'low' }
})
const corrected = response.output_text?.trim()
```

**Performance:** ~2000-3000ms total (API: ~1200-2000ms)
**Benefits:** Better at tool calling, instruction following, still intelligent

### Option 3: Keep GPT-5.1 'low' reasoning
Current setup - slower but potentially more accurate:

**Performance:** ~5000-7000ms total (API: ~4000-6000ms)
**Use case:** When accuracy matters more than speed

### Option 4: Use GPT-4.1-nano (Fastest, if available)
Smallest, fastest model:

```typescript
const MODEL = 'gpt-4.1-nano'
```

**Performance:** ~1000-1500ms total (API: ~500-800ms)
**Trade-off:** May be less accurate on complex typos

## Recommendation

For a **hotkey typo fixer**, speed is critical. Use one of:

1. **GPT-4o-mini** - Best balance (fast + proven)
2. **GPT-5.1 with `effort: 'none'`** - Latest model, no reasoning overhead
3. **GPT-4.1-nano** - Absolute fastest

## Implementation

The code now has **detailed timing instrumentation**:
- `apiMs` - Time spent waiting for OpenAI API
- `clipboardMs` - Time to read clipboard
- `pasteMs` - Time to paste result

Run the app and check the Transly debug page to see exactly where time is spent.

## Quick Fix

Change line 5 in `transly.ts`:
```typescript
// FROM:
const MODEL = 'gpt-5.1'

// TO (for speed):
const MODEL = 'gpt-4o-mini'

// Then update API call back to chat.completions.create (see Option 1 above)
```

Or keep GPT-5.1 but change line 270:
```typescript
// FROM:
reasoning: { effort: 'low' },

// TO:
reasoning: { effort: 'none' },  // No reasoning = faster
```
