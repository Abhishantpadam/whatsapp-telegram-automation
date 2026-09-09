const path = require("path");
require("dotenv").config();

const {
    loadSeenMessages,
    saveSeenMessages,
    markMessageAsSeen
} = require("./src/message-storage");

const {
    splitTelegramMessage,
    addPartIndicators
} = require("./src/telegram-utils");

const { sendTelegramMessage } = require("./src/telegram-sender");
const { parseMessageData } = require("./src/message-parser");
const {
    launchWhatsApp,
    waitForChannel,
    isChannelOpen,
    getExistingMessageIds,
    getRawMessage,
    getMessageLocators
} = require("./src/whatsapp-client");

const config = require("./src/config");

// ===============================
// CONFIGURATION
// ===============================

const TARGET_CHANNEL = "Official Job Referral...";
const TELEGRAM_CHANNEL_ID = config.telegramChannelId;
const CHECK_INTERVAL = 1500;

// ===============================
// TELEGRAM
// ===============================

async function sendTelegramPost(text) {
    const chunks = addPartIndicators(
        splitTelegramMessage(text)
    );

    for (let i = 0; i < chunks.length; i++) {
        await sendTelegramMessage(chunks[i], TELEGRAM_CHANNEL_ID);

        // Delay between chunks
        if (i < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 500));
        }
    }
}

// ===============================
// MAIN WATCHER
// ===============================

(async () => {
    const profilePath = path.join(__dirname, "whatsapp-profile");

    const { page } = await launchWhatsApp({ profilePath });

    console.log("");
    console.log("======================================");
    console.log(" WhatsApp → Telegram Archive");
    console.log("======================================");
    console.log("");
    console.log(`Target channel: ${TARGET_CHANNEL}`);
    console.log("");
    console.log("Open the target channel in WhatsApp.");
    console.log("The browser session will be monitored.");
    console.log("");

    await waitForChannel(page, TARGET_CHANNEL);
    console.log("✅ Target channel detected.");

    // Load persistent message history
    const knownMessages = loadSeenMessages();
    console.log(`📂 Loaded ${knownMessages.size} previously processed posts.`);
    console.log("");

    // Initialize existing visible posts
    const existingIds = await getExistingMessageIds(page);
    let newExistingIds = 0;

    for (const id of existingIds) {
        if (!knownMessages.has(id)) {
            knownMessages.add(id);
            newExistingIds++;
        }
    }

    if (newExistingIds > 0) {
        saveSeenMessages(knownMessages);
        console.log(`📌 Recorded ${newExistingIds} existing posts as already seen.`);
    }

    console.log(`📂 Total known posts: ${knownMessages.size}`);
    console.log("");
    console.log("👀 Watching for new posts...");
    console.log("");

    // Watch loop
    while (true) {
        try {
            if (!(await isChannelOpen(page, TARGET_CHANNEL))) {
                console.log("⚠️ Target channel is no longer open.");
                await page.waitForTimeout(3000);
                continue;
            }

            const messages = getMessageLocators(page);
            const count = await messages.count();

            for (let i = 0; i < count; i++) {
                try {
                    const messageLocator = messages.nth(i);
                    const rawMessage = await getRawMessage(messageLocator);

                    if (!rawMessage) {
                        continue;
                    }

                    if (!knownMessages.has(rawMessage.messageId)) {
                        const parsedMessage = parseMessageData(rawMessage);

                        if (!parsedMessage) {
                            continue;
                        }

                        console.log("");
                        console.log("======================================");
                        console.log("🆕 NEW POST DETECTED");
                        console.log("======================================");
                        console.log("");
                        console.log(parsedMessage.text);
                        console.log("");

                        try {
                            await sendTelegramPost(parsedMessage.text);
                            console.log("✅ Sent to Telegram");

                            markMessageAsSeen(parsedMessage.messageId, knownMessages);
                            console.log("💾 Message ID saved.");
                        } catch (telegramError) {
                            console.error("❌ Telegram error:", telegramError.message);
                            console.log("↻ Message will be retried on the next scan.");
                        }

                        console.log("");
                    }
                } catch {
                    // Element changed or scrolled out of view in DOM
                }
            }
        } catch (error) {
            console.error("⚠️ Watcher error:", error.message);
        }

        if (page.isClosed()) {
            console.log("Browser window closed. Exiting watcher.");
            break;
        }

        try {
            await page.waitForTimeout(CHECK_INTERVAL);
        } catch {
            break;
        }
    }
})();
