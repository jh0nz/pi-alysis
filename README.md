# pi-alysis

Alysis Code Pro provider and integration package for the [Pi coding agent](https://pi.dev) (`@earendil-works/pi-coding-agent`).

Provides native OAuth device login (RFC 8628), dynamic `/models` discovery, real-time token usage tracking in the status bar, and automatic credit/quota exhaustion detection.

---

## Features

- **Device Flow Authentication (RFC 8628):** Run `/login alysis` directly in Pi to open your browser at `https://alysiscode.com/activate`, approve your single-use code, and persist the long-lived gateway key (`slk_...`) securely in Pi's credential store.
- **Dynamic Model Discovery:** Automatically queries and registers the live models served by the Alysis gateway (`/models`) on startup and upon demand with `/alysis-models`.
- **Live Session Usage Tracking:** Tracks input (prompt), output (completion), cache read/write tokens, and assistant turns. Shows real-time usage in the TUI status bar (e.g., `Alysis: 14.2k tok (1.8k out)`).
- **Credit & Quota Alerts:** Intercepts HTTP 402 (Payment Required) and 429 status codes from the proxy and alerts you with a direct link to recharge credits at `https://alysiscode.com/account`.
- **Dedicated Slash Commands:**
  - `/alysis`: Overview of session connection status, active model, token usage, and account links.
  - `/alysis-usage`: Detailed breakdown of session tokens and per-model consumption.
  - `/alysis-models`: Fetch and synchronize the latest models from the gateway at runtime.
  - `/alysis-logout`: Instructions to log out or revoke active gateway keys.

---

## Supported Models

Models are dynamically retrieved from the gateway and configured with a 1M token context window, 16,384 max output tokens, DeepSeek reasoning format, and zero client-side cost deduction (credits are metered server-side):

- `deepseek-v4-flash`: Default fast model for high-volume coding (1M context, free daily allowance).
- `deepseek-v4-pro`: Flagship model with deep reasoning (1M context, Pro subscription).
- `deepseek-v4-flash-vision-exp`: Vision preview with multimodal image understanding.
- `deepseek-v4.1-flash-expires-on-0910`: Beta architecture model.

---

## Installation

### From npm

```bash
pi install npm:pi-alysis
```

### From GitHub

```bash
pi install git:github.com/jh0nz/pi-alysis
```

### From a Local Path

To install globally in user settings (`~/.pi/agent/settings.json`):

```bash
pi install /path/to/pi-alysis
```

Or for the current project only (`.pi/settings.json`):

```bash
pi install -l /path/to/pi-alysis
```

### Development / Quick Test

Test the extension without installing:

```bash
pi -e ./dist/index.js
```

---

## Getting Started

1. **Sign In:**
   In Pi, run:

   ```text
   /login alysis
   ```

   Pi will display your one-time code (e.g. `ABCD-EFGH`) and open your browser at `https://alysiscode.com/activate?code=ABCD-EFGH`. Approve the code on the web page.

2. **Select a Model:**

   ```text
   /model alysis/deepseek-v4-flash
   ```

   or:

   ```text
   /model alysis/deepseek-v4-pro
   ```

3. **Check Usage & Status:**

   ```text
   /alysis
   ```

   or:

   ```text
   /alysis-usage
   ```

4. **Refresh Models:**

   ```text
   /alysis-models
   ```

5. **Log Out:**

   ```text
   /logout alysis
   ```

---

## Environment Variables

While interactive sign-in via `/login alysis` is recommended, static API keys and custom endpoints are supported:

| Variable | Description | Default |
| --- | --- | --- |
| `ALYSIS_API_KEY` | Static gateway key (`slk_...`) for BYOK / headless environments. | None (uses OAuth credentials) |
| `ALYSIS_GATEWAY_URL` | Base OpenAI-compatible URL for chat completions and models. | `https://vzigujbcjjmpntxhmyvr.supabase.co/functions/v1/llm/v1` |
| `ALYSIS_SUPABASE_URL` | Supabase project URL hosting the edge functions. | `https://vzigujbcjjmpntxhmyvr.supabase.co` |
| `ALYSIS_SITE_URL` | Web portal host for device activation and account management. | `https://alysiscode.com` |

---

## Project Structure

```text
pi-alysis/
├── src/
│   ├── constants.ts   # Endpoint definitions, public anon key, and env helpers
│   ├── auth.ts        # RFC 8628 device flow implementation
│   ├── models.ts      # Dynamic /models discovery and model mapping
│   ├── usage.ts       # Session token tracking and footer formatting
│   └── index.ts       # Extension entry point, event listeners, and slash commands
├── dist/              # Compiled ESM bundle and TypeScript declarations
├── package.json       # Pi package manifest
└── tsconfig.json      # TypeScript compiler configuration
```

---

## License

[MIT](LICENSE) © [jh0nz](https://github.com/jh0nz)
