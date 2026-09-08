# pi-alysis

[![npm version](https://img.shields.io/npm/v/pi-alysis.svg)](https://www.npmjs.com/package/pi-alysis)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Pi Package](https://img.shields.io/badge/pi-package-blue.svg)](https://pi.dev/packages/pi-alysis)

Alysis Code Pro LLM provider and integration package for [Pi](https://pi.dev). Seamlessly connects Pi to the [Alysis Code](https://alysiscode.com) gateway with native RFC 8628 OAuth device login, dynamic model discovery, and live usage tracking.

---

## About Alysis Code Pro

[Alysis Code](https://alysiscode.com) is an AI inference gateway optimized for developers, autonomous coding agents, and high-throughput workflows.

Through its **Alysis Code Pro** service, it provides cost-effective, high-speed endpoints for state-of-the-art DeepSeek reasoning models. Key capabilities include:

- **Massive Context Windows:** 1M tokens across models for comprehensive codebase indexing, large refactors, and long-session persistence.
- **Hardware-Accelerated Reasoning:** Native support for DeepSeek chain-of-thought thinking streams and token-efficient tool calling.
- **Seamless RFC 8628 Device Flow:** One-step browser authorization without copying or managing long-lived secret keys manually.
- **Zero Client-Side Metering Overhead:** Server-side accounting with proactive balance alerts and real-time TUI status bar reporting.

To use this extension, sign in with your Alysis Code account via `/login alysis` or visit [alysiscode.com](https://alysiscode.com).

---

## Features

- **Device Flow Authentication (RFC 8628):** Run `/login alysis` directly in Pi to open your browser at `https://alysiscode.com/activate`, approve your single-use code, and persist your gateway key securely in Pi's credential store (`~/.pi/agent/auth.json`).
- **Dynamic Model Discovery:** Automatically queries the Alysis gateway API (`/models`) on startup to register available models without requiring package updates.
- **Live Session Usage Tracking:** Real-time monitoring of prompt, completion, and cache tokens with dynamic TUI status bar updates (e.g. `Alysis: 14.2k tok (1.8k out)`).
- **Credit & Quota Alerts:** Intercepts HTTP 402 (Payment Required) and 429 status codes with immediate, actionable links to recharge credits.
- **Dedicated Slash Commands:**
  - `/alysis`: Status dashboard showing gateway connectivity, active model, token statistics, and account links.
  - `/alysis-usage`: Granular breakdown of token consumption and turn counts.
  - `/alysis-models`: Runtime refresh and catalog synchronization from the gateway.
  - `/logout alysis`: Instant session logout and credential revocation.
- **Resilient Fallback:** Instant startup with built-in model definitions if offline or before authentication is configured.

---

## Supported Models

Models are dynamically retrieved from the gateway and configured with a 1M token context window, 16,384 max output tokens, DeepSeek reasoning format, and zero client-side cost deduction:

| Model ID | Context | Description |
| --- | --- | --- |
| `alysis/deepseek-v4-flash` | 1,000,000 | Default fast model for high-volume coding and rapid iteration. |
| `alysis/deepseek-v4-pro` | 1,000,000 | Flagship model with deep chain-of-thought reasoning for complex tasks. |
| `alysis/deepseek-v4-flash-vision-exp` | 1,000,000 | Vision preview model with multimodal image and diagram understanding. |
| `alysis/deepseek-v4.1-flash-expires-on-0910` | 1,000,000 | Beta preview architecture model. |

---

## Installation

Install `pi-alysis` globally in Pi using either npm or GitHub:

### From npm

```bash
pi install npm:pi-alysis
```

### From GitHub

```bash
pi install git:github.com/jh0nz/pi-alysis
```

### Temporary Run (without installation)

```bash
pi -e npm:pi-alysis
```

### Local Development / Project Install

To install for the current project only:

```bash
pi install -l /path/to/pi-alysis
```

---

## Authentication

You can authenticate using Pi's interactive `/login` command or by setting an environment variable.

### Option 1: Native Pi Login (Recommended)

Start Pi and run the login command:

```text
/login alysis
```

Pi will display your one-time code (e.g. `ABCD-EFGH`) and open your browser at `https://alysiscode.com/activate?code=ABCD-EFGH`. Approve the code on the web page, and Pi will securely store your credentials in `~/.pi/agent/auth.json`.

### Option 2: Environment Variable

Export your gateway key in your shell configuration (`~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`):

```bash
export ALYSIS_API_KEY="slk_your-gateway-key-here"
```

#### Optional Custom Endpoints

| Variable | Description | Default |
| --- | --- | --- |
| `ALYSIS_GATEWAY_URL` | Base OpenAI-compatible completions endpoint | `https://vzigujbcjjmpntxhmyvr.supabase.co/functions/v1/llm/v1` |
| `ALYSIS_SUPABASE_URL` | Supabase project URL hosting edge functions | `https://vzigujbcjjmpntxhmyvr.supabase.co` |
| `ALYSIS_SITE_URL` | Web portal host for device activation | `https://alysiscode.com` |

---

## Usage

### Interactive Selection

Start Pi and open the model selector:

```text
/model
```

Select any `alysis/...` model from the list.

### Direct Launch

```bash
# DeepSeek V4 Flash (1M context window, fast reasoning)
pi --model alysis/deepseek-v4-flash

# DeepSeek V4 Pro (1M context window, deep reasoning)
pi --model alysis/deepseek-v4-pro

# DeepSeek V4 Flash Vision
pi --model alysis/deepseek-v4-flash-vision-exp
```

### List Available Models

```bash
pi --list-models | grep alysis
```

### Session Commands

Inside Pi, manage your session with dedicated slash commands:

- `/alysis` — View connection state, active model, and token metrics.
- `/alysis-usage` — View detailed token metrics and session summary.
- `/alysis-models` — Refresh available models dynamically from the gateway.
- `/logout alysis` — Disconnect and clear credentials.

---

## Technical Details

- **Base URL:** `https://vzigujbcjjmpntxhmyvr.supabase.co/functions/v1/llm/v1`
- **Protocol:** High-performance `openai-completions` engine with Server-Sent Events (SSE) streaming.
- **Authentication:** OAuth 2.0 Device Authorization Grant (RFC 8628) with polling and verification URI.
- **Dynamic Endpoint:** Queries `GET /models` with a 3.5s timeout safeguard on startup.
- **Status Bar Integration:** Custom footer listener hooked into agent events for live token tracking.

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
├── tsconfig.json      # TypeScript compiler configuration
└── README.md          # Documentation and setup guide
```

---

## License

MIT (c) [jh0nz](https://github.com/jh0nz)
