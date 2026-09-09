# WhatsApp → Telegram Channel Archiver

[![CI](https://github.com/Abhishantpadam/whatsapp-telegram-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/Abhishantpadam/whatsapp-telegram-automation/actions/workflows/ci.yml)

## Overview

A Node.js automation tool that monitors a WhatsApp channel using Playwright and archives new posts to a Telegram channel. It uses persistent message IDs to prevent duplicate forwarding and includes automated tests and GitHub Actions CI.

Built around a real-world problem: WhatsApp channels do not provide global keyword search or easy multi-device export, making job alert channels difficult to index. This tool bridges the gap by streaming new posts into a searchable, categorized Telegram channel in real time.

---

## Features

* **WhatsApp Web Monitoring:** Real-time DOM monitoring powered by Playwright.
* **Persistent Chromium Session:** Retains authenticated WhatsApp Web cookies in a dedicated profile directory, eliminating repeated QR code scans.
* **Smart Post Detection:** Automatically expands collapsed *"Read more"* buttons before reading text, and indexes pre-existing posts on startup to avoid spamming the channel.
* **Failure-Safe Deduplication:** Saves message IDs to disk (`data/seen-messages.json`) **only after** Telegram confirms successful receipt (two-phase commit).
* **Boundary-Aware Message Chunking:** Splits posts exceeding Telegram's 4,096-character limit at the nearest newline or space boundary, appending `[Part X/Y]` indicators.
* **Rate-Limit (429) Retry Engine:** Parses Telegram's `retry_after` parameters and automatically backs off before retrying.
* **Historical Batch Ingestion:** Dedicated CLI (`sender.js`) to transfer historical messages by count, scroll depth, or date.
* **Channel Administration:** Interactive CLI utility (`cleaner.js`) to purge, time-filter, or keyword-clean Telegram messages.
* **Automated Test Suite:** 36 automated unit tests utilizing Node.js's native `node:test` runner.
* **GitHub Actions CI:** Automated continuous integration pipeline running test suites on every push and pull request.

---

## Architecture

The system uses a modular pipeline separating browser interaction, data extraction, normalization, persistence, and external API communication:

```
                      WhatsApp Web
                           │
                           ▼
                  ┌──────────────────┐
                  │whatsapp-client.js│  (Playwright Browser Actions)
                  └────────┬─────────┘
                           │ raw { messageId, text }
                           ▼
                  ┌──────────────────┐
                  │message-parser.js │  (Pure Data Normalization)
                  └────────┬─────────┘
                           │ validated message
                           ▼
                  ┌──────────────────┐
                  │message-storage.js│  (Atomic State Persistence)
                  └────────┬─────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      ┌──────────────┐            ┌──────────────┐
      │telegram-utils│            │telegram-send │  (429 Rate-Limit Retry)
      │  (Chunking)  │            └──────┬───────┘
      └──────────────┘                   │
                                         ▼
                                  ┌──────────────┐
                                  │telegram-api  │  (HTTP / Fetch Layer)
                                  └──────┬───────┘
                                         │
                                         ▼
                                  Telegram Bot API
```

`watcher.js` acts as the high-level orchestrator coordinating these modules.

---

## Tech Stack

* **Runtime:** Node.js (v18.0.0+)
* **Browser Automation:** Playwright (Chromium)
* **API Integration:** Telegram Bot API
* **Testing Framework:** Node.js native test runner (`node:test` + `node:assert/strict`)
* **CI/CD:** GitHub Actions

---

## Project Structure

```text
whatsapp-telegram-automation/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI pipeline
├── data/
│   └── .gitkeep               # Persistent storage directory (seen-messages.json gitignored)
├── src/
│   ├── config.js              # Centralized environment validation
│   ├── message-parser.js      # Pure data extraction & text normalization
│   ├── message-storage.js     # Isolated JSON file persistence & deduplication
│   ├── telegram-api.js        # Low-level Telegram HTTP fetch client
│   ├── telegram-sender.js     # Telegram dispatch with 429 rate-limit retry logic
│   ├── telegram-utils.js      # Word/newline message chunking & part headers
│   └── whatsapp-client.js     # Playwright browser lifecycle & DOM locators
├── tests/
│   ├── config.test.js         # Configuration & environment tests
│   ├── message-parser.test.js # Normalization & validation tests
│   ├── message-storage.test.js# File isolation & deduplication tests
│   ├── telegram-sender.test.js# Mocked 429 rate limit & backoff tests
│   └── telegram-utils.test.js # Boundary chunking & part indicator tests
├── .env.example               # Configuration template
├── .gitignore                 # Excludes secrets, profile data, and state
├── cleaner.js                 # Telegram channel administration CLI
├── package.json               # Dependencies and scripts
├── sender.js                  # Historical batch message transfer CLI
├── watcher.js                 # Main real-time monitoring coordinator
└── README.md                  # Project documentation
```

---

## Setup & Prerequisites

### 1. Prerequisites
* Node.js v18.0.0 or higher
* npm v9.0.0 or higher
* A Telegram Bot Token from [@BotFather](https://t.me/botfather)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Abhishantpadam/whatsapp-telegram-automation.git
cd whatsapp-telegram-automation

# Install dependencies
npm install

# Install Playwright browser binaries
npx playwright install chromium
```

### 3. Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHANNEL_ID=-100xxxxxxxxxx
TELEGRAM_ADMIN_ID=your_numeric_user_id
```

---

## Usage

### 1. Real-Time Monitoring (`watcher.js`)
```bash
node watcher.js
```
* On initial run, Chromium launches. Scan the WhatsApp Web QR code once (credentials persist in `whatsapp-profile/`).
* Open your target channel in WhatsApp. The watcher detects the active channel and streams new posts to Telegram.

### 2. Historical Message Transfer (`sender.js`)
Transfer backlogged posts with custom batch sizes:
```bash
# Send latest 5 posts
node sender.js --count 5

# Scroll 4 times to load deeper history and send latest 15 posts
node sender.js --count 15 --scroll 4
```

### 3. Telegram Channel Cleanup (`cleaner.js`)
Manage or purge destination channel posts via an interactive terminal menu:
```bash
node cleaner.js
```

---

## Testing

The project uses Node.js's native `node:test` runner. Tests are completely isolated from live browser sessions and live Telegram tokens through dependency injection and temporary test directories.

Run the test suite:
```bash
npm test
```

The test suite currently contains **36 automated unit tests** across 5 test suites:
* **`config.test.js`**: Environment variable presence, missing token handling, and admin flag checks.
* **`message-parser.test.js`**: Whitespace trimming, object structure, null/empty ID handling, and malformed inputs.
* **`message-storage.test.js`**: Disk persistence, state restoration, duplicate elimination, and corrupt JSON resilience.
* **`telegram-sender.test.js`**: Mocked 429 rate-limit retry sequences, `retry_after` backoff calculations, non-429 immediate errors, and retry exhaustion.
* **`telegram-utils.test.js`**: Boundary-aware message splitting, newline/space priorities, hard cuts, and `[Part X/Y]` indicator injection.

Tests are automatically executed on every push and pull request via **GitHub Actions**.

---

## Engineering Highlights

| Challenge | Solution |
| :--- | :--- |
| **Session Persistence** | Persistent Chromium profile preserves cookies, avoiding daily QR re-authentication. |
| **Dynamic DOM Collapsing** | Multi-locator fallback strategy discovers and expands WhatsApp's *"Read more"* buttons before reading text. |
| **API Rate Limiting (429)** | Dynamic backoff engine reads Telegram's `retry_after` header and performs bounded retries. |
| **Duplicate Delivery on Crash** | Two-phase commit: in-memory discovery + atomic disk write *only* post-HTTP 200 acknowledgment. |
| **Large Payload Handling** | Context-preserving text splitting at newline boundaries (<4,000 characters). |
| **Test State Isolation** | Test suites use isolated `os.tmpdir()` folders and mock APIs to ensure zero production state pollution. |

---

## Limitations

* Requires an authenticated WhatsApp Web session with periodic QR verification.
* WhatsApp DOM selectors may require updates if WhatsApp changes its web interface.
* The watcher currently operates as a local process rather than a containerized background service.
* Telegram Bot API limits channel administration methods without elevated bot rights.

---

## Future Improvements

* Containerized headless execution using Docker.
* Multi-channel concurrent monitoring.
* Optional SQLite database storage for richer message search and querying.

---

## License

MIT © [Abhishant Padam](https://github.com/Abhishantpadam)
