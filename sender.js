const { chromium } = require("playwright");
const path = require("path");
require("dotenv").config();

const {
    splitTelegramMessage,
    addPartIndicators
} = require("./src/telegram-utils");

const { sendTelegramMessage } = require("./src/telegram-sender");
const config = require("./src/config");

// ===============================
// CONFIGURATION
// ===============================

const TARGET_CHANNEL = "Official Job Referral...";

const TELEGRAM_CHANNEL_ID = config.telegramChannelId;

// ===============================
// PARSE COMMAND LINE ARGS
// ===============================

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        count: null,
        date: null,
        scroll: 3
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case "--count":
                options.count = parseInt(args[i + 1]);
                i++;
                break;

            case "--date":
                options.date = args[i + 1];
                i++;
                break;

            case "--scroll":
                options.scroll = parseInt(args[i + 1]);
                i++;
                break;

            case "--help":
                showHelp();
                process.exit(0);

            default:
                console.error(`Unknown option: ${args[i]}`);
                showHelp();
                process.exit(1);
        }
    }

    return options;
}

function showHelp() {
    console.log("");
    console.log("WhatsApp → Telegram Message Sender");
    console.log("===================================");
    console.log("");
    console.log("Usage:");
    console.log("");
    console.log("  node sender.js --count 5");
    console.log("    Send the last 5 posts.");
    console.log("");
    console.log("  node sender.js --date 2026-09-05");
    console.log("    Send all posts from September 5, 2026.");
    console.log("");
    console.log("  node sender.js --count 10 --scroll 5");
    console.log("    Scroll up 5 times to load more history,");
    console.log("    then send the last 10 posts.");
    console.log("");
    console.log("Options:");
    console.log("");
    console.log("  --count N     Number of posts to send (latest N)");
    console.log("  --date DATE   Send posts from a specific date (YYYY-MM-DD)");
    console.log("  --scroll N    How many times to scroll up to load older posts (default: 3)");
    console.log("  --help        Show this help message");
    console.log("");
}

// ===============================
// TELEGRAM (with chunking)
// ===============================

async function sendTelegramPost(text) {
    const chunks = addPartIndicators(
        splitTelegramMessage(text)
    );

    for (let i = 0; i < chunks.length; i++) {
        await sendTelegramMessage(chunks[i], TELEGRAM_CHANNEL_ID);

        // Delay between chunks
        if (i < chunks.length - 1) {
            await new Promise(
                r => setTimeout(r, 500)
            );
        }
    }
}

// ===============================
// EXPAND "READ MORE"
// ===============================

async function expandReadMore(message, page) {
    try {
        const expandedViaDom = await message.evaluate((msgEl) => {
            const allElements = Array.from(msgEl.querySelectorAll("*"));
            const candidates = allElements.filter((el) => {
                const text = (el.textContent || "").trim();
                return /read more/i.test(text);
            });

            const buttonEl = candidates.reverse().find((el) => {
                const text = (el.textContent || "").trim();
                return (
                    el.getAttribute("role") === "button" ||
                    el.tagName === "BUTTON" ||
                    /^(…|\.\.\.)?\s*read more$/i.test(text)
                );
            });

            if (buttonEl) {
                buttonEl.scrollIntoView?.({ block: "center" });
                buttonEl.click();
                return true;
            }
            return false;
        });

        if (expandedViaDom) {
            await page.waitForTimeout(800);
            return true;
        }

        const selectors = [
            '[role="button"]:has-text("Read more")',
            'button:has-text("Read more")',
            '[data-testid="read-more"]',
            'span[role="button"]:has-text("Read more")'
        ];

        for (const sel of selectors) {
            const btn = message.locator(sel);

            if (await btn.count() > 0) {
                await btn
                    .first()
                    .scrollIntoViewIfNeeded();

                await btn
                    .first()
                    .click({ force: true });

                await page.waitForTimeout(800);
                return true;
            }
        }
    } catch (error) {
        // Ignore
    }

    return false;
}

// ===============================
// EXTRACT DATE FROM MESSAGE
// ===============================

function extractDateFromText(text) {
    // Match common time formats like "3:04 PM" at the end
    // Look for date-like patterns in the message
    // WhatsApp shows dates as headers in the chat

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    return dateStr;
}

// ===============================
// MAIN
// ===============================

(async () => {

    const options = parseArgs();

    if (!options.count && !options.date) {
        showHelp();
        console.error(
            "❌ Please specify --count or --date"
        );
        process.exit(1);
    }

    console.log("");
    console.log("======================================");
    console.log(" WhatsApp → Telegram (Past Posts)");
    console.log("======================================");
    console.log("");

    if (options.count) {
        console.log(
            `Mode: Send last ${options.count} posts`
        );
    }

    if (options.date) {
        console.log(
            `Mode: Send posts from ${options.date}`
        );
    }

    console.log(
        `Scroll rounds: ${options.scroll}`
    );

    console.log("");

    // ==========================================
    // Launch browser
    // ==========================================

    const profilePath = path.join(
        __dirname,
        "whatsapp-profile"
    );

    const context =
        await chromium.launchPersistentContext(
            profilePath,
            {
                headless: false,

                viewport: {
                    width: 1400,
                    height: 900
                }
            }
        );

    const page =
        context.pages()[0] ||
        await context.newPage();

    await page.goto(
        "https://web.whatsapp.com"
    );

    console.log("Waiting for WhatsApp Web to load...");
    await page.waitForTimeout(8000);

    // ==========================================
    // Wait for target channel
    // ==========================================

    console.log(
        `Looking for channel: ${TARGET_CHANNEL}`
    );

    let found = false;

    for (let attempt = 0; attempt < 30; attempt++) {
        try {
            const bodyText =
                await page
                    .locator("body")
                    .innerText();

            if (bodyText.includes(TARGET_CHANNEL)) {
                found = true;
                break;
            }
        } catch (error) {
            // Ignore
        }

        await page.waitForTimeout(2000);
    }

    if (!found) {
        console.error(
            "❌ Could not find the target channel. Make sure it is open in WhatsApp."
        );

        await context.close();
        process.exit(1);
    }

    console.log("✅ Target channel detected.");
    console.log("");

    // ==========================================
    // Scroll up to load older messages
    // ==========================================

    console.log(
        `Scrolling up ${options.scroll} times to load history...`
    );

    const chatContainer = page.locator(
        '[data-testid="conversation-panel-messages"]'
    ).first();

    for (
        let s = 0;
        s < options.scroll;
        s++
    ) {
        try {
            await chatContainer.evaluate(
                el => el.scrollTop = 0
            );

            await page.waitForTimeout(2000);

            console.log(
                `  Scroll ${s + 1}/${options.scroll} done`
            );
        } catch (error) {
            console.log(
                `  Scroll ${s + 1} skipped (container not ready)`
            );
        }
    }

    // Scroll back down briefly so all messages render
    await page.waitForTimeout(1000);

    console.log("");

    // ==========================================
    // Collect all messages
    // ==========================================

    const allMessages = page.locator(
        '[data-testid^="conv-msg-"]'
    );

    const totalCount = await allMessages.count();

    console.log(
        `Found ${totalCount} posts in the loaded view.`
    );

    // ==========================================
    // Determine which messages to send
    // ==========================================

    let startIndex = 0;
    let endIndex = totalCount;

    if (options.count) {
        startIndex = Math.max(
            0,
            totalCount - options.count
        );
    }

    // ==========================================
    // Filter by date if needed
    // ==========================================

    // Collect date headers from the chat
    let targetDateLabel = null;

    if (options.date) {

        // Parse the target date
        const targetDate = new Date(
            options.date + "T00:00:00"
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(
            yesterday.getDate() - 1
        );

        // WhatsApp shows "TODAY", "YESTERDAY",
        // or formatted dates like "09/05/2026"
        if (
            targetDate.getTime() === today.getTime()
        ) {
            targetDateLabel = "TODAY";
        } else if (
            targetDate.getTime() === yesterday.getTime()
        ) {
            targetDateLabel = "YESTERDAY";
        } else {
            // WhatsApp format: MM/DD/YYYY or DD/MM/YYYY
            const dd = String(
                targetDate.getDate()
            ).padStart(2, "0");

            const mm = String(
                targetDate.getMonth() + 1
            ).padStart(2, "0");

            const yyyy = targetDate.getFullYear();

            // Try both formats
            targetDateLabel = `${mm}/${dd}/${yyyy}`;
        }

        console.log(
            `Looking for date label: ${targetDateLabel}`
        );
    }

    // ==========================================
    // Process and send messages
    // ==========================================

    let sentCount = 0;
    let currentDate = null;

    console.log("");
    console.log("Processing posts...");
    console.log("");

    for (
        let i = startIndex;
        i < endIndex;
        i++
    ) {

        const message = allMessages.nth(i);

        try {

            // If filtering by date, check if this
            // message is under the target date header.

            if (options.date) {

                const prevSiblings =
                    await message.evaluate(el => {
                        let node = el.previousElementSibling;
                        const texts = [];

                        while (node && texts.length < 5) {
                            texts.push(
                                node.textContent || ""
                            );
                            node = node.previousElementSibling;
                        }

                        return texts;
                    });

                const dateContext =
                    prevSiblings.join(" ").toUpperCase();

                if (targetDateLabel) {
                    const hasDate = dateContext.includes(
                        targetDateLabel.toUpperCase()
                    ) || dateContext.includes(
                        targetDateLabel
                    );

                    if (
                        dateContext.includes("TODAY") ||
                        dateContext.includes("YESTERDAY") ||
                        /\d{2}\/\d{2}\/\d{4}/.test(dateContext)
                    ) {
                        if (hasDate) {
                            currentDate = targetDateLabel;
                        } else if (currentDate) {
                            continue;
                        }
                    }

                    if (
                        currentDate !== targetDateLabel
                    ) {
                        continue;
                    }
                }
            }

            // Scroll this message into view first
            try {
                await message.scrollIntoViewIfNeeded();
                await page.waitForTimeout(300);
            } catch (scrollErr) {
                // Ignore scroll errors
            }

            // Expand "Read more"
            await expandReadMore(message, page);

            const text =
                await message.innerText();

            console.log(
                `  [Post ${i + 1}/${totalCount}] ` +
                `Text length: ${text ? text.trim().length : 0}`
            );

            if (
                !text ||
                text.trim().length === 0
            ) {
                console.log(
                    `  ⏭️ Skipped (empty text)`
                );
                continue;
            }

            sentCount++;

            console.log(
                `  [${sentCount}] Sending post...`
            );

            // Send to Telegram
            await sendTelegramPost(text);

            console.log(
                `  [${sentCount}] ✅ Sent to Telegram`
            );

            // Delay between posts to avoid
            // Telegram rate limits
            await new Promise(
                r => setTimeout(r, 3000)
            );

        } catch (error) {
            console.error(
                `  ⚠️ Error on post ${i + 1}: ${error.message}`
            );
        }
    }

    // ==========================================
    // Done
    // ==========================================

    console.log("");
    console.log("======================================");
    console.log(
        `✅ Done! Sent ${sentCount} posts to Telegram.`
    );
    console.log("======================================");
    console.log("");

    await context.close();
    process.exit(0);

})();
