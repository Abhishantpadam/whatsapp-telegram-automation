# WhatsApp → Telegram Channel Automation & Management Tool

A robust browser automation and data pipeline built with **Node.js**, **Playwright**, and the **Telegram Bot API**. It monitors WhatsApp channels in real time, extracts new text posts, and forwards them to a Telegram channel with persistent state tracking, smart message chunking, and rate-limit handling.

It also includes CLI utilities for historical message synchronization and Telegram channel administration.

---

## Architecture Overview

```
                      WhatsApp Web
                           │
                           ▼
                  ┌──────────────────┐
                  │ Playwright Engine│
                  │ (Persistent Auth)│
                  └────────┬─────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼                           ▼
      ┌──────────────┐            ┌──────────────┐
      │  watcher.js  │            │  sender.js   │
      │  (Real-Time  │            │ (Historical  │
      │  Monitoring) │            │  Batch CLI)  │
      └──────┬───────┘            └──────┬───────┘
             │                           │
             ├───────────────────────────┤
             ▼                           ▼
     ┌──────────────┐            ┌──────────────┐
     │ Deduplication│            │ Text Chunker │
     │  (JSON Store)│            │ & Retry Gate │
     └──────┬───────┘            └──────┬───────┘
            │                           │
            └─────────────┬─────────────┘
                          ▼
                  Telegram Bot API
                          │
                          ▼
                 Telegram Destination
                          ▲
                          │ (Admin Clean / Manage)
                  ┌───────┴──────┐
                  │  cleaner.js  │
                  └──────────────┘
```

---

## Key Features

### 1. Real-Time Browser Automation (`watcher.js`)
* **Persistent Authentication:** Uses Playwright's `launchPersistentContext` to preserve WhatsApp Web session cookies, preventing repeated QR code logins.
* **Dynamic DOM Handling:** Automatically locates and expands WhatsApp's *"Read more"* buttons before reading post contents.
* **Channel Guard:** Detects if the target channel loses focus or navigates away and gracefully waits for reconnection.

### 2. Failure-Safe State Persistence
* **No Lost Posts:** Processed message IDs are stored persistently in `data/seen-messages.json`.
* **Atomic State Updates:** A message ID is committed to storage **only after** Telegram acknowledges successful delivery. If Telegram fails or encounters network drops, the message is retained for automatic retry on the next cycle.

### 3. API Reliability & Rate-Limit Handling
* **Boundary-Aware Chunking:** Automatically splits posts exceeding Telegram's 4,096-character limit at the nearest newline or word boundary, tagging multi-part posts with `[Part X/Y]`.
* **Exponential Backoff on HTTP 429:** Parses Telegram's `retry_after` parameter and automatically backs off before retrying.

### 4. Historical Batch Ingestion CLI (`sender.js`)
* Fetch and synchronize historical channel posts on demand:
  * By post count: `node sender.js --count 10`
  * With automatic page scrolling: `node sender.js --count 20 --scroll 5`
  * Filter by specific dates: `node sender.js --date YYYY-MM-DD`

### 5. Channel Maintenance & Administration (`cleaner.js`)
* Interactive terminal CLI to purge or manage channel contents:
  * Bulk delete all posts with safety confirmation.
  * Time-windowed deletion (`< 48 hours` or `> 48 hours`).
  * Targeted keyword-based message deletion.

---

## Project Structure

```
whatsapp-channel-archiver/
├── data/
│   ├── .gitkeep
│   └── seen-messages.json    # Local persistent message ID store (gitignored)
├── .env.example              # Environment template
├── .gitignore                # Protects secrets, session profile, and state
├── cleaner.js                # Telegram channel management utility
├── package.json              # Project metadata and dependencies
├── sender.js                 # Historical message batching CLI
├── watcher.js                # Continuous real-time monitor
└── README.md                 # Documentation
```

---

## Quick Start

### 1. Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
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

### 3. Environment Setup
Copy the template and fill in your credentials:
```bash
cp .env.example .env
```

Open `.env` and set:
* `TELEGRAM_BOT_TOKEN`: Token obtained from BotFather.
* `TELEGRAM_CHANNEL_ID`: Channel username or numerical ID (`-100...`).
* `TELEGRAM_ADMIN_ID`: Your numerical Telegram user ID (from [@userinfobot](https://t.me/userinfobot)).

---

## Usage

### 1. Launch Real-Time Monitoring
```bash
node watcher.js
```
1. Chromium will launch. On first start, scan the WhatsApp QR code (session is saved locally in `whatsapp-profile/`).
2. Open the desired WhatsApp channel.
3. The watcher will detect the channel, index existing posts to prevent duplicate blasting, and stream all new posts to Telegram.

### 2. Send Historical Posts
```bash
# Send latest 5 posts
node sender.js --count 5

# Scroll 4 times to fetch deeper history and send latest 15 posts
node sender.js --count 15 --scroll 4
```

### 3. Manage Telegram Channel Posts
```bash
node cleaner.js
```
Presents an interactive menu to clean posts by date, time window, or keyword.

---

## Engineering & QA Highlights

| Engineering Problem | Solution Implemented |
| :--- | :--- |
| **Session Persistence** | Dedicated Chromium profile cache persists authentication without re-authenticating. |
| **DOM Element Mutation** | Multi-selector fallback strategy for expanding collapsible messages (`Read more`). |
| **API Rate Limiting (429)** | Dynamic backoff matching Telegram API's `retry_after` header + 3 max retries. |
| **Duplicate Delivery on Crash** | Two-phase commit: in-memory detection + disk write *only* post-HTTP 200 response. |
| **Large Payload Handling** | Context-preserving text splitting at newline boundaries (<4,000 characters). |

---

## License

MIT © [Abhishant Padam](https://github.com/Abhishantpadam)
