# i18nizer 🌍

![banner](./imgs/banner.png)

<div align="center">
<img src="https://img.shields.io/badge/Node.js-5FA04E?logo=nodedotjs&logoColor=fff&style=for-the-badge" alt="Node.js Badge">
<img src="https://img.shields.io/badge/oclif-000?logo=oclif&logoColor=fff&style=for-the-badge" alt="oclif Badge">
<img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff&style=for-the-badge" alt="TypeScript Badge">
<img src="https://img.shields.io/npm/dw/i18nizer.svg?style=for-the-badge" alt="npm downloads">
<img src="https://img.shields.io/github/license/yossTheDev/i18nizer?style=for-the-badge" alt="license">
<img src="https://img.shields.io/github/actions/workflow/status/yossTheDev/i18nizer/test.yml?style=for-the-badge&label=tests" alt="test status">
</div>

---

**i18nizer automates the boring parts of i18n.**

If your project already uses **i18next**, **next-intl**, or **Paraglide JS**, i18nizer:

- extracts hardcoded strings from JSX/TSX
- can extract source messages **without AI**
- can generate translated JSON files using **AI-assisted translations**
- creates readable keys with deterministic fallback
- rewrites your components to use `t("key")` or `m.key_name()`

No runtime, no lock-in, no SaaS.  
Just a CLI that fits into your existing development workflow.

## 🤖 How translations work

i18nizer can use AI providers (OpenAI, Gemini, Hugging Face) to generate
translations at development time.

- Translations are generated once and stored as plain JSON files
- Output is fully editable and version-controlled
- `extract` does not require AI
- `translate --dry-run` does not require AI
- No AI is required at runtime
- Cached translations avoid repeated AI requests

You own the result — i18nizer only automates the process.

## Who is this for?

- React / Next.js developers already using i18next, next-intl, or Paraglide JS
- Teams tired of manually extracting strings and managing i18n JSONs
- Projects that want automation without changing runtime behavior

## Supported AI Providers

- **OpenAI**
- **Google Gemini**
- **Hugging Face (DeepSeek)**

      Used for development-time translations and key generation.

---

## 🚀 Installation

```bash
npm install -g i18nizer
```

> Requires Node.js 18+

### Use from a local source checkout

If you want to run the CLI from this repository while developing locally:

```bash
corepack yarn install
corepack yarn build
npm link
i18nizer --help
```

`npm link` exposes the `i18nizer` command from your local checkout. If you change the source, run `corepack yarn build` again before using the linked binary.

---

## 🔑 API Keys Configuration

```bash
i18nizer keys --setOpenAI <YOUR_OPENAI_API_KEY>
i18nizer keys --setGemini <YOUR_GEMINI_API_KEY>
i18nizer keys --setHF <YOUR_HUGGING_FACE_API_KEY>
```

Keys are stored inside:

```
[HOME]/.i18nizer/api-keys.json
```

---

## ⚡ Quick Start

### Initialize Your Project

#### Interactive Mode (Recommended)

```bash
i18nizer start
```

This launches an **interactive setup** that will:

- 🔍 Auto-detect your framework (Next.js or React)
- 🔍 Auto-detect your i18n library (next-intl, react-i18next, i18next, paraglide-js)
- ❓ Ask you to confirm or change the detected settings
- ✅ Create `i18nizer.config.yml` with optimal defaults
- 📁 Set up `.i18nizer/` directory for caching and project data
- 📂 Create `messages/` directory for translation files

#### Non-Interactive Mode (CI/Automation)

```bash
i18nizer start --yes
```

Auto-detects and uses default values without prompts.

#### Manual Configuration

Specify framework and i18n library explicitly:

```bash
# Next.js with next-intl
i18nizer start --framework nextjs --i18n next-intl

# React with react-i18next
i18nizer start --framework react --i18n react-i18next

# React with Paraglide JS
i18nizer start --framework react --i18n paraglide-js

# Custom setup
i18nizer start --framework custom --i18n custom
```

**Available options:**

- `--framework`: `nextjs`, `react`, `custom`
- `--i18n`: `next-intl`, `react-i18next`, `i18next`, `paraglide-js`, `custom`
- `--yes`, `-y`: Skip interactive prompts
- `--force`, `-f`: Re-initialize existing project

### Translate Your Components

**Translate a single file:**

```bash
i18nizer translate src/components/Login.tsx --locales en,es,fr
```

**Translate all components in your project:**

```bash
i18nizer translate --all --locales en,es,fr
```

**Preview changes without modifying files:**

```bash
i18nizer translate <file> --dry-run
```

`translate --dry-run` resolves keys and previews the rewrite flow without calling an AI provider.

**Show generated JSON output:**

```bash
i18nizer translate <file> --show-json
```

### Regenerate Aggregator

**Rebuild the auto-generated aggregator file:**

```bash
i18nizer regenerate
```

This command regenerates the `i18n/messages.generated.ts` file by scanning all JSON files in your messages directory. Use this when:

- You manually add or remove translation JSON files
- You rename JSON files
- The aggregator becomes out of sync with your messages

The aggregator automatically uses valid TypeScript identifiers for imports, converting hyphenated filenames (e.g., `notification-item.json`) to PascalCase identifiers (e.g., `NotificationItem_en`).

### Extract Source Messages Without AI

```bash
i18nizer extract <file-path> --locales en,es,fr
```

`extract` is deterministic by default:

- it does **not** require AI translations
- it writes only the **default/source locale** file
- it respects the configured output format (`json` or `inlang-message-format`)

Examples:

```bash
# Standard namespaced JSON
i18nizer start --framework react --i18n react-i18next
i18nizer extract src/components/Login.tsx --locales en,es

# Paraglide JS / inlang message format
i18nizer start --framework react --i18n paraglide-js
i18nizer extract src/components/Login.tsx --locales en,es
```

Flags:

- `--locales` → Requested languages; extract writes the default/source locale file
- `--use-ai-keys` → Use AI for key naming if you explicitly want it
- `--provider` → `openai | gemini | huggingface` (only relevant with `--use-ai-keys`)

---

## 🧩 Example

### Input Component

```tsx
export function Login() {
  return (
    <div>
      <h1>Welcome back</h1>
      <p>Please sign in to continue</p>
      <button>Sign in</button>
    </div>
  );
}
```

---

### Output Component (Automatically Rewritten)

```tsx
import { useTranslations } from "next-intl";

export function Login() {
  const t = useTranslations("Login");

  return (
    <div>
      <h1>{t("welcomeBack")}</h1>
      <p>{t("pleaseSignInToContinue")}</p>
      <button>{t("signIn")}</button>
    </div>
  );
}
```

---

### Generated JSON (`messages/en/login.json`)

```json
{
  "Login": {
    "welcomeBack": "Welcome back",
    "pleaseSignInToContinue": "Please sign in to continue",
    "signIn": "Sign in"
  }
}
```

**Note:** The filename uses lowercase-hyphen format (`login.json`), while the namespace inside uses PascalCase (`Login`).

### Paraglide Output (`messages/en.json`)

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "welcome_back": "Welcome back",
  "please_sign_in_to_continue": "Please sign in to continue",
  "sign_in": "Sign in"
}
```

With Paraglide config, rewritten code uses `m.key_name()`:

```tsx
import { m } from "./paraglide/messages.js";

export function Login() {
  return <button>{m.sign_in()}</button>;
}
```

---

## 📂 Project Structure

When initialized with `i18nizer start`:

```
your-project/
├─ i18nizer.config.yml       # Configuration file
├─ .i18nizer/
│  ├─ cache/
│  │  └─ translations.json   # Translation cache
│  └─ ...
├─ i18n/
│  └─ messages.generated.ts  # Auto-generated aggregator (imports all JSON files)
└─ messages/                 # Translation files (configurable path)
   ├─ en/
   │  └─ login.json          # Lowercase-hyphen format for filenames
   ├─ es/
   │  └─ login.json
   └─ fr/
      └─ login.json
```

**Note:** JSON filenames use lowercase-hyphen format (e.g., `notification-item.json`, `user-profile.json`), while the namespace inside the JSON file uses PascalCase (e.g., `NotificationItem`, `UserProfile`). The auto-generated aggregator converts filenames to valid TypeScript identifiers.

Legacy standalone mode (without `i18nizer start`):

```
[HOME]/.i18nizer/
├─ api-keys.json
├─ tsconfig.json
├─ i18n/
│  └─ messages.generated.ts  # Auto-generated aggregator
└─ messages/
   ├─ en/
   │  └─ login.json
   ├─ es/
   │  └─ login.json
   └─ fr/
      └─ login.json
```

---

## ⚙️ Configuration

The `i18nizer.config.yml` file controls all aspects of how i18nizer processes your project. Here's a complete reference:

### Complete Configuration Reference

```yaml
# Framework and i18n library settings
framework: react                    # nextjs | react | custom
i18nLibrary: react-i18next          # next-intl | react-i18next | i18next | paraglide-js | custom

# AI provider configuration
ai:
  provider: openai                  # openai | gemini | huggingface
  model: gpt-4                      # AI model to use for translations

# Directory paths
paths:
  src: src                          # Source code directory
  i18n: i18n                        # i18n output directory

# i18n function configuration
i18n:
  function: t                       # Translation function name (or m for Paraglide)
  import:
    source: react-i18next           # Package/module to import from
    named: useTranslation           # Named import (or m for Paraglide)

# Translation file settings
messages:
  path: messages                    # Where to store translation JSON files
  defaultLocale: en                 # Default locale
  locales:                          # List of supported locales
    - en
    - es
  format: json                      # json | inlang-message-format

# Behavior settings
behavior:
  detectDuplicates: true            # Reuse keys for duplicate strings across components
  opinionatedStructure: true        # Use opinionated file structure
  autoInjectT: true                 # Auto-inject translation hooks (disable for Next.js Server Components)
  useAiForKeys: true                # Use AI to generate English keys
  allowedFunctions:                 # Functions whose string arguments should be translated
    - alert
    - confirm
    - prompt
  allowedMemberFunctions:           # Member functions whose string arguments should be translated
    - toast.error
    - toast.info
    - toast.success
    - toast.warn
  allowedProps:                     # JSX props that should be translated
    - alt
    - aria-label
    - aria-placeholder
    - helperText
    - label
    - placeholder
    - text
    - title
    - tooltip
```

### Translation Function Injection (`autoInjectT`)

i18nizer can automatically inject translation hooks into your components:

```ts
const t = useTranslations("ComponentName");
```

This behavior is controlled by `behavior.autoInjectT` in `i18nizer.config.yml`:

**Next.js Projects** (disabled by default):

```yaml
behavior:
  autoInjectT: false  # Disabled to avoid breaking Server Components
```

- Server Components cannot use hooks like `useTranslations`
- i18nizer will replace strings with `t("key")` but won't inject the hook
- You manually add the translation hook where appropriate

**React Projects** (enabled by default):

```yaml
behavior:
  autoInjectT: true  # Safe for Client Components
```

- Full automation: injects hooks and replaces strings
- Works seamlessly with React components

**Why disabled for Next.js?**

- Automatically detecting Server vs Client Components is ambiguous
- Injecting hooks in Server Components causes runtime errors
- User has full control over translation function placement

You can override this setting in your `i18nizer.config.yml` if you know your setup.

### AI-Powered English Key Generation (`useAiForKeys`)

i18nizer uses AI to generate **English camelCase keys** regardless of your source language:

```yaml
behavior:
  useAiForKeys: true  # Default: enabled
```

**Benefits:**

- **Consistent keys**: Keys are always in English, even if your source text is in Spanish, French, German, etc.
- **Readable**: `welcomeBack` instead of `bienvenidoDeNuevo`
- **Stable**: Keys are cached per source text for deterministic behavior across runs
- **Minimal diffs**: Same source text always produces the same key

**How it works:**

1. First run: AI generates an English key for each source text
2. Key is cached with the source text hash
3. Subsequent runs: Cached key is reused (no AI call needed)
4. Fallback: If AI is unavailable, uses deterministic camelCase generation

**Example:**

Source text (Spanish):

```tsx
<h1>Bienvenido de nuevo</h1>
<button>Iniciar sesión</button>
```

Generated keys (English):

```json
{
  "welcomeBack": "Bienvenido de nuevo",
  "signIn": "Iniciar sesión"
}
```

**Disabling AI key generation:**

If you prefer deterministic key generation based on source text:

```yaml
behavior:
  useAiForKeys: false
```

Note: Keys will be in the source language (e.g., `bienvenidoDeNuevo` for Spanish text).

### AI Provider and Model Configuration

i18nizer supports multiple AI providers for translations. You can configure the provider and model in `i18nizer.config.yml`:

```yaml
ai:
  provider: openai        # openai | gemini | huggingface
  model: gpt-4           # AI model name
```

**Supported Providers:**

- **OpenAI** (default): Uses OpenAI API with models like `gpt-4`, `gpt-4o-mini`, etc.
- **Google Gemini**: Uses Google's Gemini API with models like `gemini-2.5-flash`, `gemini-pro`
- **Hugging Face**: Uses Hugging Face Inference API with models like `deepseek-ai/DeepSeek-V3.2`

**Default Configuration:**

```yaml
ai:
  provider: openai
  model: gpt-4
```

**Example Configurations:**

For Google Gemini:
```yaml
ai:
  provider: gemini
  model: gemini-2.5-flash
```

For Hugging Face:
```yaml
ai:
  provider: huggingface
  model: deepseek-ai/DeepSeek-V3.2
```

**Note:** You still need to set up API keys using:
```bash
i18nizer keys --setOpenAI <YOUR_OPENAI_API_KEY>
i18nizer keys --setGemini <YOUR_GEMINI_API_KEY>
i18nizer keys --setHF <YOUR_HUGGING_FACE_API_KEY>
```

The provider setting in config file will be used by default, but you can override it on a per-command basis using the `--provider` flag:
```bash
i18nizer translate <file> --provider gemini
```

### Paths Configuration

Configure default paths for your source code and i18n files in `i18nizer.config.yml`:

```yaml
paths:
  src: src               # Source directory
  i18n: i18n             # i18n output directory
```

**Default Configuration:**

```yaml
paths:
  src: src
  i18n: i18n
```

**Custom Example:**

```yaml
paths:
  src: source
  i18n: locales
```

These paths serve as defaults and can help organize your project structure. The `messages.path` setting (which specifies where translation JSON files are stored) is separate from `paths.i18n`.

---

## ✨ Features

### Phase 1 (Current)

- **Project-level integration** with `i18nizer start` and `i18nizer translate`
- **Configuration system** with `i18nizer.config.yml`
- **Framework presets** (Next.js + next-intl, React + react-i18next, React + Paraglide JS)
- **Intelligent caching** to avoid redundant AI translation requests
- **String deduplication** with deterministic key reuse
- **AI-free extraction** for source/default locale message files
- **AI-free dry-run mode**
- **AI-powered English key generation** for consistent, readable keys regardless of source language
- **Configurable behavior** (allowed functions, props, member functions)
- **Dry-run mode** to preview changes
- **JSON output preview** with `--show-json`
- **Pluralization documentation** - comprehensive guide for ICU message format
- **Rich text formatting documentation** - patterns for JSX within translations
- Project-wide or single-file translation
- Works with **JSX & TSX**
- Rewrites components automatically (`t("key")` or `m.key_name()`)
- Generates **English camelCase keys** (AI-assisted with deterministic fallback)
- Supports **any number of locales**
- Isolated TypeScript parsing (no project tsconfig required)
- Friendly logs with colors and spinners

### Supported Extraction Cases

- **JSX text children**: `<div>Hello</div>`
- **JSX attributes**: `placeholder`, `title`, `alt`, `aria-label`, `aria-placeholder`, `label`, `text`, `tooltip`, `helperText`
- **String literals**: `placeholder="Enter name"`
- **Curly-braced strings**: `placeholder={"Enter name"}`
- **Template literals**: `` placeholder={`Enter name`} ``
- **Template literals with placeholders**: `` <p>{`Hello ${name}`}</p> ``
- **Ternary operators**: `placeholder={condition ? "Text A" : "Text B"}`
- **Logical AND**: `{condition && "Visible text"}`
- **Logical OR**: `{condition || "Fallback text"}`
- **Nested expressions**: Complex combinations of the above

### Filtering & Quality

- **Skips non-translatable content**: Single symbols (`*`, `|`), punctuation-only strings (`...`), whitespace
- **Deterministic key generation**: Same input always produces the same key
- **Stable JSON output**: Alphabetically sorted keys, consistent formatting
- **2-space indentation**: Clean and diff-friendly JSON files

---

## 🎨 Advanced i18n Patterns

i18nizer extracts translatable strings and generates standard i18n message files. Advanced pluralization and rich text handling depend on the runtime you use; the examples below focus on i18next and next-intl patterns.

### Pluralization Support

Both i18next and next-intl support ICU message format for handling plurals. After i18nizer extracts your strings, you can enhance them with plural rules.

**Before i18nizer:**
```tsx
<p>{count} {count === 1 ? 'item' : 'items'} in cart</p>
```

**After i18nizer extraction:**
```tsx
<p>{t('itemCount', { count })} {t('itemsLabel', { count })}</p>
```

**Manual enhancement to use pluralization:**
```tsx
<p>{t('itemsInCart', { count })}</p>
```

**Translation with ICU plural format:**
```json
{
  "itemsInCart": "{count, plural, =0 {No items} one {# item} other {# items}} in cart"
}
```

**How plurals work:**
- `=0` - Exact match for zero
- `one` - Singular form (1 item in English)
- `other` - Plural form (2+ items)
- `#` - Placeholder for the count number

**Additional plural categories** (language-dependent):
- `zero`, `one`, `two`, `few`, `many`, `other`

### Rich Text Formatting

When you need JSX elements within translated text (like links or bold text), both i18next and next-intl provide rich text formatting capabilities.

**Before i18nizer:**
```tsx
<p>By clicking Sign Up, you agree to our <a href="/terms">Terms of Service</a></p>
```

**After i18nizer extraction:**
```tsx
<p>{t('byClickingSignUpYouAgree')} <a href="/terms">{t('termsOfService')}</a></p>
```

**Manual enhancement with rich text (next-intl):**
```tsx
<p>{t.rich('signUpAgreement', {
  terms: (chunks) => <a href="/terms">{chunks}</a>
})}</p>
```

**Translation:**
```json
{
  "signUpAgreement": "By clicking Sign Up, you agree to our <terms>Terms of Service</terms>"
}
```

**Using rich text with i18next:**
```tsx
import { Trans } from 'react-i18next';

<p>
  <Trans i18nKey="signUpAgreement">
    By clicking Sign Up, you agree to our <a href="/terms">Terms of Service</a>
  </Trans>
</p>
```

**Translation:**
```json
{
  "signUpAgreement": "By clicking Sign Up, you agree to our <1>Terms of Service</1>"
}
```

### More Examples

**Date and time formatting:**
```tsx
// Using next-intl
<p>{t('lastUpdated', { date: new Date() })}</p>

// Translation
{
  "lastUpdated": "Last updated: {date, date, medium}"
}
```

**Number formatting:**
```tsx
// Using next-intl
<p>{t('price', { amount: 99.99 })}</p>

// Translation
{
  "price": "{amount, number, currency}"
}
```

**Nested plurals:**
```tsx
<p>{t('cartSummary', { itemCount: 5, totalPrice: 149.99 })}</p>

// Translation
{
  "cartSummary": "{itemCount, plural, one {# item} other {# items}} • Total: ${totalPrice}"
}
```

---

## 🔮 Roadmap

### ✅ Phase 0: Foundation & Reliability (Complete)

- Stable extraction and replacement
- Deterministic key generation
- Comprehensive test coverage
- JSON output quality

### ✅ Phase 1: Project Integration (Complete)

- `i18nizer start` command for project initialization
- `i18nizer translate` command with `--all` flag
- Configuration system with YAML
- Framework detection and presets
- Intelligent caching system
- Cross-file string deduplication
- Configurable behavior (allowed props, functions, etc.)
- Dry-run and JSON preview modes

### 🚧 Phase 2: Advanced Features (Planned)

- [ ] Automatic pluralization detection and conversion
- [ ] Automatic rich text formatting detection
- [ ] Watch mode for continuous translation
- [ ] Non-AI fallback mode
- [ ] Framework support (Vue, Svelte)
- [ ] Additional i18n library presets
- [ ] Context-aware translations
- [ ] Translation memory and glossary

---

## ⚠️ Current Limitations

- AI-generated keys may vary between runs (deterministic fallback available)
- Cached keys minimize diffs across runs.
- Only supports React JSX/TSX (no Vue, Svelte yet)
- Does not handle runtime-only string generation

---

## ⚠️ Notes

- API keys are **never committed**
- JSON files are stored in `/{HOME}/.i18nizer/`
- Designed for incremental adoption

---

Made with ❤️ by **Yoannis Sánchez Soto**
