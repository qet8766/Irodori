# Manual Test Plan for transly.ts

## Test Cases

### ✅ Test 1: Empty Clipboard After Copy
**Steps:**
1. Trigger the hotkey when no text is selected
2. Expected: Should return error "Copy failed" with empty input
3. Check: `result.pasted === false` and `result.error` contains "Copy failed"

### ✅ Test 2: API Returns Empty/Null
**Scenario:** OpenAI API returns empty content
**Expected:** Error "API returned empty", `result.pasted === false`

### ✅ Test 3: Network/API Error
**Scenario:** OpenAI API throws error (network timeout, rate limit, etc.)
**Expected:** Error message from exception, `result.pasted === false`

### ✅ Test 4: PowerShell Worker Compilation Error
**Scenario:** C# compilation fails in PowerShell
**Expected:** Should handle gracefully, may timeout or return error

### ✅ Test 5: Command Timeout
**Scenario:** PowerShell worker doesn't respond to commands
**Expected:** Should timeout after 2 seconds, continue or return error

### ✅ Test 6: SendInput Failure (sent=0)
**Scenario:** Windows UIPI blocks input or SendInput fails
**Expected:** Logs warning, clipboard remains empty, returns "Copy failed" error

### ✅ Test 7: Very Long Text
**Steps:**
1. Select text longer than 1000 characters
2. Trigger hotkey
3. Expected: Should process correctly, API receives full text

### ✅ Test 8: Special Characters & Unicode
**Test with:** `こんにちは 🎉 "quotes" 'apostrophe' \n\t`
**Expected:** Should preserve all characters correctly

### ✅ Test 9: Worker Process Dies
**Scenario:** PowerShell worker exits unexpectedly
**Expected:** Next call should recreate worker and work normally

### ✅ Test 10: Normal Success Case
**Steps:**
1. Select text with typo: "teh quick"
2. Trigger hotkey
3. Expected: Corrected to "the quick", `result.pasted === true`

## Edge Cases Verified

1. ✅ Empty clipboard handling
2. ✅ API failures (empty, null, error)
3. ✅ Worker initialization failures
4. ✅ Command timeouts (2s timeout on sendCommand)
5. ✅ SendInput failures (UIPI blocking)
6. ✅ Long text handling (10k+ characters)
7. ✅ Special characters & unicode
8. ✅ Worker process crashes & recovery
9. ✅ Timing metrics included in all results
10. ✅ Proper error propagation

## Code Review Findings

### Strengths:
- Proper timeout handling (8s for worker init, 2s for commands, 1.5s for clipboard polling)
- Error handling with try-catch
- Timing metrics for performance monitoring
- Worker reuse pattern to avoid recreation overhead
- Proper cleanup of event listeners
- Graceful degradation on failures

### Debug/Logging Code to Remove:
- Lines 8-9: `DEBUG` flag and `log` function
- Lines 151, 159, 165-167, 172, 176, 180, 189, 206, 213, 227: All `log()` calls
- Lines 241, 244, 250, 254, 256, 260, 262, 266-267, 274, 281, 288, 299, 310, 323, 327, 329: All `log()` calls
- Line 338: `console.error(err)`
- Line 350: Pre-warming log message

### Potential Issues:
- Line 265-268: The warning about `sent=0` is useful but verbose - could be simplified
- Worker is pre-warmed on module load (line 350-351) - this is good for performance
