---
name: EmuFlight Locale Maintenance & Translation Protocol
description: AI instruction for safely translating and maintaining non-English locale files without breaking code, HTML, variables, or structure
applyTo: "locales/**/*.json"
---

# EmuFlight Locale Maintenance & Translation Protocol

> **CRITICAL RULE:** Keys are NEVER translated. ONLY values are translated. Keys must match English source exactly in every locale.

## Overview

This instruction defines the complete workflow for translating and maintaining EmuFlight locale files (`locales/**/*.json`) while preserving code integrity, HTML structure, programmatic variables, and escaped characters.

**Reference:** [TRANSLATION-TERMINOLOGY.instructions.md](TRANSLATION-TERMINOLOGY.instructions.md) — Always consult this for English terms that must NOT be translated.

---

## Phase 1: Pre-Translation Verification

### 1.1 Validate Source File Integrity
Before beginning any translation work:

- **Structural Metadata Awareness**: Always identify the context of a string before script-based cleanup. Messages aren't just text; they are combined with HTML, CSS classes, and variables.
- **Zero-Breakage Mandate**: Never remove, modify, or strip functional metadata (HTML tags, CSS classes, `$1` variables, `{{variableName}}` handlebars) unless the English source itself has changed.
- **KEY PROTECTION (CRITICAL):** NEVER translate, modify, or customize key names. Keys must be **identical** in all locales. If you change a key name, the app BREAKS.
- **Acronym/Industry Standard Protection**: Single-word technical acronyms (PID, OSD, VTX) must remain in English to maintain documentation consistency across flight control platforms (Betaflight/EmuFlight/iNav).
- **Inheritance vs. Accuracy**: While short terms should inherit when identical to English, core UI labels (Connect, Save, Reboot) and status messages (Port Opened, Arming Enabled) **MUST** be authentically translated when they appear as UI action button labels; when they appear in technical documentation or comments, keep them in English (see [TRANSLATION-TERMINOLOGY.instructions.md](TRANSLATION-TERMINOLOGY.instructions.md) Preservation Strategy §5).

#### Validation Commands:
```bash
# Verify JSON syntax is valid
python3 -m json.tool locales/en/messages.json > /dev/null

# Check for trailing newline (POSIX compliance)
tail -c 1 locales/en/messages.json | wc -l  # Should output: 1

# Check file does not have BOM
file locales/en/messages.json  # Should NOT show "UTF-8 (with BOM)"
```

### 1.2 Audit for Common Defects
Search the English source for known issues that must NOT be replicated:

```bash
# Trailing spaces in message values
grep -n '" $' locales/en/messages.json

# Unescaped backslashes (should be \\, not \)
grep -n '[^\\]\\[^"]' locales/en/messages.json

# Count HTML tags (verify balance manually)
grep -o '<[a-z]*[^>]*>' locales/en/messages.json | sort | uniq -c
```

---

## Phase 1b: No-Crowdin Project — English Fallback Strategy

**EmuConfigurator does NOT use Crowdin or any translation pipeline.** Non-English translations are manually maintained by contributors. This has a critical implication for how stale and dead keys must be handled.

### Stale keys are worse than missing keys

i18next fallback works for **missing** keys (key absent from locale file → shows English). It does **NOT** fall back for **present but stale** keys (key exists with outdated translation → shows wrong content, not English).

```
Missing key  → falls back to English ✓ (correct behavior)
Stale key    → shows old/wrong translation ✗ (blocks fallback)
```

**Rule:** When an English message value changes significantly, **delete the key from all non-English locales** to force English fallback rather than leaving stale content.

### Dead key purging

When a feature is removed from the UI (toggle removed, tab renamed, etc.), remove the corresponding i18n key from **all locale files under `locales/`** — including English. Dead keys in non-English files continue to show stale content for users; dead keys in English are wasted bytes.

```bash
# Find which locales have a key
grep -rl '"pidTuningShowAllPids"' locales/
```

### Adding new UI features

When introducing a new message, add its key and English value only to
`locales/en/messages.json`. Non-English locales use English fallback until
a contributor supplies a translation.

In follow-up translation work, contributors may add translations of existing
English messages to non-English locale files. EmuConfigurator maintains these
translations manually; it does not use Crowdin or an automated translation
pipeline.

Keep each key identical to the English source. Translate only the message
value, and preserve all required technical terms, HTML, and placeholders —
see [TRANSLATION-TERMINOLOGY.instructions.md](TRANSLATION-TERMINOLOGY.instructions.md)
for the full verbatim-term reference.

Do not add guessed translations merely to make locale files complete.
Missing translations may continue to use English fallback.

Follow-up translations remain subject to the specific fallback-only rules
below, including the `pidTuningSubTab*` label rules.

### Sub-tab label keys

The project uses `pidTuningSubTab*` keys for PID tuning sub-tab labels. Non-English locales historically had stale or verbatim-English translations for these keys. The correct state is:
- English locale has all 5 sub-tab keys with accurate values
- Non-English locales have **none** of these keys (force fallback to English)

---

## Phase 1c: Understanding Sparse Translation Files (i18next Design)

**Expected:** Non-English locale files do NOT need to have every key from English.

**Why:** i18next uses **fallback mechanism**:
- Missing keys automatically use English value at runtime
- Sparse files are valid and encouraged (reduce file size)
- Example: If Spanish is missing `"advancedPIDHelp"`, app shows English version

**Valid Sparse State:**
```json
// locales/es/messages.json (Spanish) - legitimate sparse file
{
    "tabMainSettings": { "message": "Configuración" },
    "tabPidTuning": { "message": "Sintonización PID" }
    // ← "advancedPIDHelp" is MISSING, app will use English
}
```

**INVALID Key Errors:**
```json
// ✗ WRONG - key name doesn't match English
"tabSintonizacion": { "message": "..." }  // Key must be "tabPidTuning"

// ✗ WRONG - translated key name
"pestanaAjustePID": { "message": "..." }  // Key must stay "tabPidTuning"
```

---

## Phase 1d: i18next Plural Forms (Awareness Stub)

**Current Status:** No locale files in this project currently use i18next plural-form keys. This stub documents the convention so future contributors handle plural keys correctly if they are ever introduced.

### Convention Overview
i18next uses suffix-based plural keys. Suffixes depend on the i18next version and language:

| Suffix | i18next v2 | i18next v3+ (Plurals v4) |
|--------|------------|--------------------------|
| Singular | `key` | `key_one` |
| Plural | `key_plural` | `key_other` |
| Zero (special) | `key_0` | `key_zero` |

### Rules If Plural Keys Are Introduced
1. **Add plural keys to English only first** — same rule as any new key (see Phase 1b).
2. **Non-English locales may omit plural variants** — i18next falls back to the base key or English.
3. **Languages with complex plural rules** (Polish, Arabic, etc.) require additional suffixes; consult the [i18next pluralization docs](https://www.i18next.com/translation-function/plurals) for the correct suffix set for each target language.
4. **Fallback applies to each variant independently** — a missing `key_plural` in a non-English locale falls back to English `key_plural`, not to `key`.

### Current State Verification
```bash
# Verify no plural keys currently exist (expected: no output)
grep -E '"[a-zA-Z]+(_plural|_one|_other|_zero|_two|_few|_many)":' locales/en/messages.json
```

---

## Phase 2: Translation Rules

### 2.0 CRITICAL: Preserve Key Names Exactly

**This is THE most important rule. Violating it breaks the entire application.**

Every key in a locale file must:
- Have the exact same name as in English (camelCase, every letter)
- NEVER be translated or modified
- NEVER have capitalization changed
- NEVER be customized to match the translation

```bash
# Verification command (MUST show empty output for EXTRA keys)
python3 << 'EOF'
import json
with open('locales/en/messages.json') as f: en_keys = set(json.load(f).keys())
with open('locales/XX/messages.json') as f: target_keys = set(json.load(f).keys())
extra = target_keys - en_keys
if extra:
    print(f"ERROR: {len(extra)} extra/wrong keys found: {list(extra)[:5]}")
else:
    print("✓ All keys match English source exactly")
EOF
```

### 2.1 Preserve Non-Translatable Value Elements

**DO NOT translate or modify:**

#### A. Technical Terms (Reference TRANSLATION-TERMINOLOGY.instructions.md)
- PID control terms: `PID`, `P-Term`, `I-Term`, `D-Term`, `iTerm Relax`, `i-Decay`, `Setpoint`, `Deadband`
- Axis terms: `Roll`, `Pitch`, `Yaw`, `RP`, `RY`, `PY`
- Sensors: `gyro`, `accel`, `baro`, `mag`, `GPS`, `IMU`, `OSD`
- Protocols: `DSHOT`, `Multishot`, `Oneshot`, `ProShot1000`, `CRSF`, `UART`, `SPI`, `I2C`
- Features: `Feathered PIDs`, `Direct Yaw Feed Forward`, `RC Smoothing`, `Anti Gravity`
- Firmware names: `Betaflight`, `EmuFlight`, `iNav`

Example:
```json
// CORRECT - preserve technical terms
"featheredPidsHelp": {
    "message": "[YOUR_LANGUAGE_TRANSLATION] Feathered PIDs [YOUR_TRANSLATION] D-Term [YOUR_TRANSLATION]"
}

// WRONG - translated the technical term
"featheredPidsHelp": {
    "message": "[YOUR_LANGUAGE_TRANSLATION] PIDs Emplumados [BREAKS CONSISTENCY]"
}
```

#### B. HTML Tags (Must Remain Untouched)
- `<span>`, `<strong>`, `<br>`, `<br />`, `<a>`, `</a>`, `<i>`, `</i>`, `<b>`, `</b>`
- All HTML attributes: `class`, `href`, `target`, `style`
- Special HTML entities: `&nbsp;`, `&lt;`, `&gt;`, `&quot;`, `&#...;`

Example:
```json
// CORRECT - HTML preserved, only text translated
"failsafeWarning": {
    "message": "<span class=\"message-negative\">ATTENZIONE</span>: configurare il failsafe"
}

// WRONG - HTML modified or removed
"failsafeWarning": {
    "message": "ATTENZIONE: configurare il failsafe"  // Missing <span> tags
}
```

#### C. Programmatic Variables and Interpolations
- `$t(...)` — i18next translation lookups
- `$1`, `$2`, `$3`, etc. — parameter substitution placeholders
- `{{variableName}}` — variable interpolation
- `\n` — newline escape sequences
- `\t` — tab escape sequences
- `\\` — escaped backslashes
- `\"` — escaped quotes

Example:
```json
// CORRECT - variables preserved exactly
"osdMessage": {
    "message": "Velocità: $1 km/h, Tensione: {{voltage}}V"
}

// WRONG - variable removed or modified
"osdMessage": {
    "message": "Velocità: km/h, Tensione: V"  // $1 and {{voltage}} removed
}

// WRONG - escape sequence broken
"message": "Linea 1\nLinea 2"  // \n changed to actual newline in JSON
```

#### D. Escaped Characters (Double-Escape Required in JSON)
- Quotes must be `\"` (escaped for JSON)
- Backslashes must be `\\` (escaped for JSON)
- Newlines must be `\n` (not actual line breaks)
- Forward slashes do NOT require escaping in JSON strings
- **Apostrophe vs Escape:** Use direct apostrophes `'` in contracted words (Italian `nell'intervallo`, `dell'arresto`) — do NOT escape apostrophes as `\"` (that creates quote characters, not apostrophes)

Example:
```json
// CORRECT — apostrophe in contraction
"message": "È nell'intervallo"

// WRONG — escaped quote creates " not '
"message": "È nell\"intervallo"  // Renders as: È nell"intervallo

// CORRECT — escaped backslash
"message": "C:\\Users\\Documents"

// CORRECT — forward slashes do NOT need escaping
"message": "https://github.com/emuflight/EmuFlight"
```

#### E. Key Names (CRITICAL — Never Touch)
- **GOLDEN RULE:** Key names must NEVER be modified, translated, or customized under ANY circumstances
- Key names must be **identical** in ALL locale files (EN, ES, FR, DE, IT, etc.)
- If a key exists in English, it MUST exist with the exact same name in target locale
- **JavaScript/i18next convention:** Keys use `camelCase` (e.g., `pidTuningDtermSetpointHelp`)
- **DO NOT:**
  - ✗ Translate key names: `pidRate` is NOT `tauxPid` or `tassoLaura`
  - ✗ Change capitalization: `pidRate` is NEVER `PidRate` or `PIDRATE`
  - ✗ Modify hierarchy: Keys have no structure; each is a unique identifier
  - ✗ Add/remove/rename keys based on translation needs
- **If a key doesn't exist in English:** Use the English value as-is; DO NOT create a localized key name

Example:
```json
// CORRECT — key identical, only message translated
"pidTuningDtermSetpointHelp": {  // ← Key NEVER changes
    "message": "Aumenta el peso de la configuración..."  // ← Only this translates
}

// WRONG — key name translated (BREAKS APP)
"ayudaPesoConfiguracionDterm": {  // ✗ NEVER do this
    "message": "Aumenta el peso de la configuración..."
}

// WRONG — key name capitalized differently (CODE CAN'T FIND IT)
"PidTuningDtermSetpointHelp": {  // ✗ NEVER do this
    "message": "Aumenta el peso de la configuración..."
}  
```

Example:
```json
// CORRECT - key name unchanged, message translated
"pidTuningDtermSetpointHelp": {
    "message": "[YOUR_LANGUAGE_TRANSLATION]"
}

// WRONG - key name changed
"pidTuningDtermSetpointAyuda": {
    "message": "[YOUR_LANGUAGE_TRANSLATION]"  // KEY NAME CHANGED - BREAKS CODE
}

// WRONG - Presence of a restricted key
"language_ca": {
    "message": "Català",
    "description": "Don't translate!!!"
} // REMOVE THIS ENTIRE OBJECT - SHOULD NOT EXIST IN TRANSLATIONS
```

### 2.2 Cross-Key Consistency Rules

When translating related keys, ensure consistency across the entire locale:

#### A. Terminology Consistency
Technical terms must use the same translation wherever they appear:

```json
// WRONG — same concept, inconsistent terminology
"tabFailsafe": { "message": "Failsafe" },
"failsafeSwitchTitle": { "message": "Modo Failsafe de Interruptor" },
"failsafeDelayItem": { "message": "Retraso de Seguridad de Falla" }

// CORRECT — use unified term
"tabFailsafe": { "message": "Failsafe" },
"failsafeSwitchTitle": { "message": "Failsafe por Interruptor" },
"failsafeDelayItem": { "message": "Retraso de Failsafe" }
```

#### B. Formality Level Consistency
Within a single locale, maintain consistent formality (formal `Sie`/informal `du` in German, etc.):

```json
// WRONG — mixed formality
"firmwareMSPNotSupported": { "message": "Bitte aktualisieren Sie EmuConfigurator." },  // formal Sie
"tabSettings": { "message": "Bitte aktualisiere die Einstellung." }  // informal du

// CORRECT — consistent informal style
"firmwareMSPNotSupported": { "message": "Bitte aktualisiere EmuConfigurator." },
"tabSettings": { "message": "Bitte aktualisiere die Einstellung." }
```

#### C. Compound Words (Germanic Languages)
Verify compounds are joined, not split:

```json
// WRONG — split compound
"featureANTI_GRAVITY": { "message": "bei starken Gas Änderungen" }

// CORRECT — joined compound
"featureANTI_GRAVITY": { "message": "bei starken Gasänderungen" }
```

#### D. Capitalization Consistency
Related keys must match capitalization style:

```json
// WRONG — inconsistent
"receiverChannelMap": { "message": "Mappa canali" },  // lowercase
"receiverChannelMapTitle": { "message": "Mappa Canali" }  // uppercase

// CORRECT — consistent
"receiverChannelMap": { "message": "Mappa canali" },
"receiverChannelMapTitle": { "message": "Mappa canali" }
```

### 2.3 Translation Guidelines

#### A. Context Preservation
Always understand the context of the string before translating:
- Read the `"description"` field if present
- Search for usage in `src/**/*.js`, `src/**/*.html` to understand how the variable is used
- Maintain tone (formal, technical, casual) consistent with original

#### B. HTML-Adjacent Translation
Keep space between HTML tags and text:

```json
// CORRECT - space after closing tag
"message": "Dispositivo USB <span class=\"success\">collegato</span> correttamente"

// WRONG - no space after tag
"message": "Dispositivo USB<span class=\"success\">collegato</span>correttamente"  // Words run together
```

#### C. Parameter Placement
Parameters (`$1`, `$2`) may move within translation but must remain in the message:

```json
// ENGLISH
"message": "Motor speed: $1 RPM, Throttle: $2%"

// SPANISH (parameters moved for grammar)
"message": "Velocidad del motor: $1 RPM, Acelerador: $2%"

// ITALIAN (same order)
"message": "Velocità motore: $1 RPM, Acceleratore: $2%"
```

#### D. Avoid Over-Translation
Don't translate explanatory text if it references code or configuration:

```json
// CORRECT - leave CLI variable names untranslated
"message": "Impostare 'debug_mode = 1' nel CLI per abilitare"

// WRONG - translates the configuration name
"message": "Impostare 'modalità_debug = 1' nel CLI per abilitare"  // Breaks documentation
```

---

## Phase 3: Prohibited Modifications

### 3.1 Dangerous Modifications

| What NOT to do | Consequence | Example |
|---|---|---|
| Remove CSS classes | UI rendering breaks/style loss | `"<span class=\"pos\">OK</span>"` → `"OK"` ❌ |
| Change key names | Code can't find translation | `"pidRate"` → `"ratePid"` ❌ |
| Break escape sequences | JSON parse error | `"path\\to\\file"` → `"path\to\file"` ❌ |
| Add unescaped quotes | JSON syntax error | `"He said "hello""` ❌ Use `\"` instead |
| Strip Handlebars | Dynamic data display fails | `"User: {{name}}"` → `"User: "` ❌ |
| Remove/translate `$t(...)` variable refs | Missing translation lookup | `"$t(pidTuningRate.message)"` → `"Frequenza PID"` ❌ |
| Alter `$1`, `$2` placeholders | Runtime parameter errors | `"Speed: $1"` → `"Velocità: "` (missing $1) ❌ |
| Remove HTML tags | UI rendering breaks | `"<span>warning</span>"` → `"warning"` ❌ |
| Remove newlines in multiline text | Message display corrupts | `"Line1\nLine2"` → `"Line1 Line2"` ❌ |

### 3.2 Common Translation Pitfalls

#### A. Over-Localization
```json
// WRONG - translated the technical term, breaking consistency
"pidTuningProportional": {
    "message": "Proporcional"  // OK for display
}
// BUT if code references this value programmatically, it breaks

// CORRECT - keep original term, add translation as needed
"pidTuningProportional": {
    "message": "Proporcional (P)"  // Descriptive, but don't change the meaning
}
```

#### B. HTML Tag Misalignment
```json
// WRONG - tag wraps wrong word
"message": "Status OK <strong>sistema</strong>"
// Should be: "Status <strong>OK</strong> sistema"
```

#### C. Interpolation Variable Loss
```json
// WRONG
"message": "Batteria: 11.8V"  // $t variable removed

// CORRECT
"message": "Batteria: {{voltage}}V"  // Variable preserved
```

#### D. Inconsistent Terminology
```json
// WRONG - same concept, two different names
"key1": { "message": "Giroscopio" },
"key2": { "message": "Gyro" }  // Should be consistent

// CORRECT
"key1": { "message": "Giroscopio (Gyro)" },
"key2": { "message": "Giroscopio (Gyro)" }  // Same term everywhere
```

#### E. UI Field Disambiguation
When translating related but distinct UI fields, ensure each has a **unique, context-specific label** that communicates its distinct purpose:

```json
// WRONG — confusing field pair, user can't distinguish
"vtxChannel": { "message": "Canal" },
"vtxFrequencyChannel": { "message": "Canal VTX" }  // Too similar, looks like duplicate

// CORRECT — explicit unit/context clarifies field purpose
"vtxChannel": { "message": "Canal" },
"vtxFrequencyChannel": { "message": "Freqüència VTX (MHz)" }  // Clear: expects MHz value, not channel number
```

**Guidelines for disambiguation:**
- **Add unit/context:** For numeric fields, include unit (MHz, V, A) or type (`(MHz)`, `(channel #)`, `(Hz)`)
- **Vary word choice:** Use synonyms or context words (`Canal` vs `Freqüència`)
- **Reverse order:** Sometimes swapping the order helps (`"VTX Freqüència"` vs `"Canal VTX"`)
- **Parenthetical clarification:** `"Name (type)"` pattern: `"Freqüència VTX (MHz)"`, `"Configuració del sistema (Setup)"` vs `"Configuració (Config)"`

**Example from Catalan:**
- `tabSetup` = "Impostacions" (Settings/Configuration - app setup)
- `tabConfiguration` = "Configuració" (Configuration - device configuration)
- `tabConfiguration` ≠ `tabSetup` — distinct purposes even though both are "configuration" concepts

---

## Phase 4: Translation Workflow

### Step 1: Pre-Translation Locale Audit
Before beginning any new translations in a locale:
1. **Check existing terminology:** Search for related keys and verify  what terms are already in use
2. **Identify style:** Note formality level, capitalization patterns, compound word usage
3. **Document decisions:** Keep a quick reference of terminology choices

```bash
# Example: find all failsafe-related keys
grep -i failsafe locales/es/messages.json | grep -o '"[^"]*": {' | sort
```

### Step 2: Extract & Review Untranslated Keys
Create a temporary file with only keys that need translation (filtering out restricted ones):
1. **Identify Redundancies**: Keys where the target message matches the English exactly (case-sensitive) should be **deleted** to allow inheritance
2. **Exclude Meta-Keys**: Ensure zero occurrences of `language_xx` or `"description": "Don't translate!!!"`
3. **Check Consistency Patterns**: Review existing translations in related key groups for terminology/formality/capitalization patterns

### Step 3: Translate Message Values Only
For each key requiring translation:
1. **Extract** the English `"message"` value
2. **Cross-Reference:** Search for related keys already translated; match terminology
3. **Check Consistency Rules:** 
   - **Terminology:** Same concept = same term across all keys
   - **Formality:** Match formal/informal level with existing strings
   - **DSHOT:** Must always be ALL-CAPS `DSHOT` (never `DShot`, `dshot`, `d-shot`)
   - **Compounds:** Germanic languages join compounds (`Gasänderungen`, not `Gas Änderungen`)
   - **Apostrophes:** Romance languages use `'` not `\"` for contractions
4. **Preserve:** All technical terms, HTML tags, `$1`, `$t()`, `{{...}}` variables
5. **Preserve:** `"description"` fields unchanged (translator notes)
6. **Validate:** Check for JSON syntax errors after each group

### Step 4: Consistency Audit
Before full validation, perform targeted consistency checks:

```bash
# 1. DSHOT must always be all-caps
grep -i 'dshot\|d-shot' locales/${TARGET_LOCALE}/messages.json | grep -v DSHOT
# Output should be EMPTY

# 2. Related terminology (example: failsafe)
grep -i failsafe locales/${TARGET_LOCALE}/messages.json | head -5
# Review: should use same term across all failsafe keys

# 3. Formality (Germanic languages)
grep -E '\b(Sie|du)\b' locales/${TARGET_LOCALE}/messages.json | cut -d: -f1 | sort -u
# Review: should see only Sie OR du, not both

# 4. Apostrophes (Romance languages)
grep 'dell\\"|nell\\"|ill\\"|ull\\"' locales/${TARGET_LOCALE}/messages.json
# Output should be EMPTY — use ' not \" for contractions
```

### Step 5: Validate JSON Structure
After completing translations:
```bash
# Validate JSON syntax
python3 -m json.tool locales/${TARGET_LOCALE}/messages.json > /dev/null || echo "JSON INVALID"

# Verify key count matches English
python3 -c "import json; en=len(json.load(open('locales/en/messages.json'))); tg=len(json.load(open('locales/${TARGET_LOCALE}/messages.json'))); print(f'EN: {en}, TARGET: {tg}')"

# Verify trailing newline exists
tail -c 1 locales/${TARGET_LOCALE}/messages.json | wc -l  # Should be: 1
```

### Step 6: Verify No Broken References
```bash
# Check for orphaned $t(...) references
grep -o '\$t([^)]*\.message)' locales/${TARGET_LOCALE}/messages.json | sort -u > /tmp/refs.txt
grep -o '"[a-z][^"]*":' locales/${TARGET_LOCALE}/messages.json | grep -o '[^"]*' | sort -u > /tmp/keys.txt

# Extract key names from references and compare
sed 's/\$t(\([^.]*\).*/\1/' /tmp/refs.txt | sort -u > /tmp/ref_keys.txt
comm -23 /tmp/ref_keys.txt /tmp/keys.txt  # Should be empty
```

---

## Phase 5: Pre-Commit Safety Checklist

Before staging and committing locale changes:

**Critical Checks:**
- [ ] **DSHOT Always All-Caps** ✓: `grep -i dshot` should output only `DSHOT`, never `DShot`, `dshot`, `d-shot`
- [ ] **Terminology Consistency** ✓: Related keys use same terms (e.g., all failsafe keys use consistent terminology)
- [ ] **Formality Consistency** ✓: Germanic languages (DE, SV, etc.) use consistent formal/informal address
- [ ] **Compound Words** ✓: Germanic languages joined not split (e.g., `Gasänderungen`, not `Gas Änderungen`)
- [ ] **Apostrophe Handling** ✓: Romance languages use `'` not `\"` for contractions (e.g., `nell'intervallo`)
- [ ] **Capitalization Consistency** ✓: Related keys (e.g., `receiverChannelMap` vs `receiverChannelMapTitle`) match

**Standard Checks:**
- [ ] **JSON Syntax Valid**: `python3 -m json.tool locales/XX/messages.json > /dev/null`
- [ ] **Trailing Newline Present**: `tail -c 1 locales/XX/messages.json | wc -l` == 1
- [ ] **No Escaped Slash Issues**: Verify forward slashes in URLs remain unescaped
- [ ] **All HTML Tags Preserved**: Balanced tags, proper spacing around text
- [ ] **All Variables Preserved**: `$1`, `$t()`, `{{...}}` all intact
- [ ] **No Key Names Changed**: Compare key count with English
- [ ] **No Descriptions Modified**: Only `"message"` fields translated
- [ ] **Technical Terms Preserved**: Spot-check terms from [TRANSLATION-TERMINOLOGY.instructions.md](TRANSLATION-TERMINOLOGY.instructions.md)
- [ ] **No Restricted Keys Present**: Verified no keys marked `"description": "Don't translate!!!"` have propagated
- [ ] **No Trailing Spaces**: `grep '" $' locales/XX/messages.json` should be empty
- [ ] **Escape Sequences Correct**: Backslashes are `\\`, quotes are `\"` (not for apostrophes)
- [ ] **4-Space Indentation**: File uses 4-space indentation — match when adding keys
- [ ] **Key Order Preserved**: Keys follow the same insertion order as `locales/en/messages.json`
- [ ] **Consider automating**: Add a pre-commit hook or CI step for JSON validity and DSHOT checks

---

## Phase 6: Git Workflow

### Commit Message Format
```bash
git commit -m "translate(i18n): add Spanish (es) locale translations

- Complete message translation for locales/es/messages.json
- Preserved all HTML tags, variables, and technical terms per TRANSLATION-TERMINOLOGY.instructions.md
- Validated JSON syntax and structure
- No key removal or renaming"
```

### Verification Before Push
```bash
# Show diff
git diff locales/${TARGET_LOCALE}/messages.json | head -100

# Verify only message values changed, not keys
git diff locales/${TARGET_LOCALE}/messages.json | grep '^-    "[a-z]' | wc -l  # Should be 0

# Check statistics
git diff --stat locales/${TARGET_LOCALE}/messages.json
```

---

## Phase 7: Testing & Validation

### Runtime Testing
1. **Launch the app**: `yarn dev`
2. **Switch locale** in UI settings to the newly translated language
3. **Verify UI renders correctly**:
   - No `missingKey` warnings in browser console
   - HTML formatting intact (bold, links, spacing)
   - Variables populated correctly (e.g., motor speeds show numbers, not `$1`)
   - Technical terms appear as expected (not translated)
4. **Test critical tabs**: Configuration, PID Tuning, Ports
5. **Check console for errors**: No JSON parse errors, no undefined references

### Code Search Validation
```bash
# Confirm no missing-key errors: open Developer Tools console (Ctrl+Shift+I) and filter for "missingKey"
# (runtime check — not a shell command; should be empty for a complete translation)

# Verify all $t() references exist as keys
grep -o '\$t([^)]*\.message)' locales/XX/messages.json | \
  sed 's/\$t(\([^.]*\).*/\1/' | sort -u | \
  while read key; do
    grep -q "\"$key\":" locales/XX/messages.json || echo "MISSING: $key"
  done
```

---

## Safety Reminders

### DO - KEY PROTECTION (Most Critical - Application Breaking If Violated)
- ✓ **NEVER modify key names** — keys must be identical in all locales
- ✓ **NEVER translate key names** — `pidRate` stays `pidRate`, never becomes `tauxPid` or `frecuencia`
- ✓ **NEVER change key capitalization** — `pidRate` is never `Pidrate`, `PIDRATE`, or `PidRate`
- ✓ **Use camelCase for all keys** — JavaScript/i18next standard (e.g., `pidTuningDtermSetpointHelp`)
- ✓ **Verify with `comm -23`** — ensure no extra/wrong keys before committing
- ✓ Test: Every key in locale must exist in English source code with identical spelling and case

### DO - VALUE PROTECTION
- ✓ Reference [TRANSLATION-TERMINOLOGY.instructions.md](TRANSLATION-TERMINOLOGY.instructions.md) for every translation
- ✓ **Use `DSHOT` all-caps always** — never `DShot`, `dshot`, or `d-shot`
- ✓ Verify **terminology consistency** across related keys (e.g., all failsafe keys match)
- ✓ Maintain **consistent formality** within locale (formal/informal address)
- ✓ **Join compound words** in Germanic languages (e.g., `Gasänderungen`, not `Gas Änderungen`)
- ✓ Use `'` for **apostrophes in contractions**, not escaped `\"` (e.g., Italian `nell'intervallo`)
- ✓ Test in the running app; verify UI renders correctly
- ✓ Preserve ALL HTML tags, escaped characters, and variables
- ✓ Validate JSON syntax before committing

### DON'T - KEY VIOLATIONS (Application Breaking If Violated)
- ✗ Translate key names (e.g., `pidTuning` → `sintonizacionPID`) — **BREAKS ENTIRE APP**
- ✗ Change key capitalization (e.g., `pidRate` → `PidRate`) — **CODE CAN'T FIND THE KEY**
- ✗ Add extra keys not in English — orphaned keys pollute memory
- ✗ Modify key names to match translation needs — use the English key as-is
- ✗ Create custom key names because translation needs them — NEVER

### DON'T - VALUE ERRORS
- ✗ Translate technical terms (PID, DSHOT, Gyro, etc.) — reference [TRANSLATION-TERMINOLOGY.instructions.md](TRANSLATION-TERMINOLOGY.instructions.md)
- ✗ Use any DSHOT variation except ALL-CAPS `DSHOT`
- ✗ Mix formality levels within a single locale file
- ✗ Split Germanic compound words with spaces
- ✗ Use escaped quotes `\"` for apostrophes — use direct `'`
- ✗ Remove or alter HTML tags, `$t()` references, or parameter placeholders
- ✗ Add unescaped quotes or backslashes (must use `\"` and `\\`)
- ✗ Commit without verifying JSON syntax and consistency checks
- ✗ Remove the trailing newline at EOF
- ✗ Assume translations are correct without testing in the app

---

## Quick Reference

| Element | Translate? | Example |
|---------|-----------|------|
| `$t(...)`  | ✗ NO | `"$t(pidRate.message)"` → keep as-is |
| `$1`, `$2` | ✗ NO | `"Speed: $1"` → translate around, keep `$1` |
| HTML tags | ✗ NO | `<span>`, `<strong>`, `<a>` → all untouched |
| Technical terms | ✗ NO | `PID`, `DSHOT`, `Gyro` → preserve per TERMINOLOGY guide |
| Escaped chars | ✗ NO | `\"`, `\\`, `\n` → keep escape sequences |
| Key names | ✗ NO | `"pidRate":` → don't change |
| Descriptions | ✗ NO | `"description":` field → don't translate |
| Message values | ✓ YES | `"message":` → **TRANSLATE THIS** |
| Forward slashes | ✗ NO | `https://...` → no escaping needed |
| Apostrophes (contractions) | ✗ NO | `'` not `\"` (e.g., `nell'intervallo`) |
| Compounds (Germanic) | ✗ NO | Joined not split (e.g., `Gasänderungen`) |

---

**Last Updated:** 2026-10-09  
**Status:** Active Protocol  
**Critical Updates:**
- 2026-10-09: Clarified "Adding new UI features" to distinguish initial message creation from follow-up translations; added cross-reference to TRANSLATION-TERMINOLOGY for verbatim-term guidance
- 2026-04-12: Added cross-key consistency audit rules (DSHOT, terminology, formality, compounds, apostrophes)
- 2026-04-12: Integrated DSHOT standard (all-caps enforcement)
- 2026-04-12: Added consistent pre-translation audit and consistency checks
- 2026-04-12: Emphasized apostrophe handling for Romance languages
