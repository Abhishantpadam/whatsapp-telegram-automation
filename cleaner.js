const readline = require("readline");
const config = require("./src/config");
const { telegramAPI } = require("./src/telegram-api");

// ===============================
// CONFIGURATION
// ===============================

const TELEGRAM_CHANNEL_ID = config.telegramChannelId;
const TELEGRAM_ADMIN_ID = config.telegramAdminId;

// ===============================
// READLINE HELPER
// ===============================

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => {
        rl.question(question, answer => {
            resolve(answer.trim());
        });
    });
}

// ===============================
// GET LATEST MESSAGE ID
// ===============================

async function getLatestMessageId() {
    // Send a temporary message to get the latest ID
    const result = await telegramAPI("sendMessage", {
        chat_id: TELEGRAM_CHANNEL_ID,
        text: "⏳ Scanning channel..."
    });

    if (!result.ok) {
        throw new Error(
            "Could not send test message. Is the bot an admin?"
        );
    }

    const latestId = result.result.message_id;

    // Delete the temp message
    await telegramAPI("deleteMessage", {
        chat_id: TELEGRAM_CHANNEL_ID,
        message_id: latestId
    });

    return latestId;
}

// ===============================
// GET MESSAGE DATE BY FORWARDING
// ===============================

async function getMessageInfo(messageId) {
    // Forward message to admin chat to read its date
    const result = await telegramAPI("forwardMessage", {
        chat_id: TELEGRAM_ADMIN_ID,
        from_chat_id: TELEGRAM_CHANNEL_ID,
        message_id: messageId,
        disable_notification: true
    });

    if (!result.ok) {
        return null; // Message doesn't exist or can't be forwarded
    }

    const msg = result.result;

    // Delete the forwarded copy from admin chat
    await telegramAPI("deleteMessage", {
        chat_id: TELEGRAM_ADMIN_ID,
        message_id: msg.message_id
    });

    // Extract original date
    let originalDate = null;

    // Bot API 7.0+ uses forward_origin
    if (msg.forward_origin && msg.forward_origin.date) {
        originalDate = msg.forward_origin.date;
    }
    // Older Bot API uses forward_date
    else if (msg.forward_date) {
        originalDate = msg.forward_date;
    }
    // Fallback to message date
    else {
        originalDate = msg.date;
    }

    // Extract text preview
    const textPreview =
        (msg.text || msg.caption || "[media]")
            .substring(0, 80);

    return {
        messageId: messageId,
        date: originalDate,
        dateStr: new Date(originalDate * 1000)
            .toLocaleString(),
        preview: textPreview
    };
}

// ===============================
// DELETE A MESSAGE
// ===============================

async function deleteMessage(messageId) {
    const result = await telegramAPI("deleteMessage", {
        chat_id: TELEGRAM_CHANNEL_ID,
        message_id: messageId
    });

    return result.ok === true;
}

// ===============================
// SCAN CHANNEL MESSAGES
// ===============================

async function scanMessages(latestId, filterFn) {

    const matching = [];
    let scanned = 0;
    let notFound = 0;
    const maxNotFound = 50; // Stop after 50 consecutive missing messages

    console.log("");
    console.log("Scanning messages...");
    console.log("");

    for (
        let id = latestId;
        id >= 1;
        id--
    ) {
        const info = await getMessageInfo(id);

        scanned++;

        if (!info) {
            notFound++;

            if (notFound >= maxNotFound) {
                console.log(
                    `  Reached ${maxNotFound} consecutive missing messages. Stopping scan.`
                );
                break;
            }

            continue;
        }

        // Reset not-found counter
        notFound = 0;

        // Apply filter
        if (filterFn(info)) {
            matching.push(info);
        }

        // Progress update every 10 messages
        if (scanned % 10 === 0) {
            process.stdout.write(
                `\r  Scanned: ${scanned} | Found: ${matching.length}    `
            );
        }

        // Small delay to avoid rate limits
        await new Promise(
            r => setTimeout(r, 100)
        );
    }

    console.log("");
    console.log(
        `  Scan complete. Scanned: ${scanned} | Matches: ${matching.length}`
    );

    return matching;
}

// ===============================
// DELETE WITH CONFIRMATION
// ===============================

async function deleteWithConfirmation(messages) {

    if (messages.length === 0) {
        console.log("");
        console.log("No matching posts found.");
        return;
    }

    console.log("");
    console.log("======================================");
    console.log(` Posts to delete: ${messages.length}`);
    console.log("======================================");
    console.log("");

    // Show preview of posts
    const previewCount = Math.min(
        messages.length,
        10
    );

    for (let i = 0; i < previewCount; i++) {
        const msg = messages[i];
        console.log(
            `  ${i + 1}. [${msg.dateStr}] ${msg.preview}...`
        );
    }

    if (messages.length > 10) {
        console.log(
            `  ... and ${messages.length - 10} more`
        );
    }

    console.log("");

    const confirm = await ask(
        `⚠️  Are you sure you want to delete ${messages.length} posts? (yes/no): `
    );

    if (
        confirm.toLowerCase() !== "yes" &&
        confirm.toLowerCase() !== "y"
    ) {
        console.log("❌ Cancelled.");
        return;
    }

    console.log("");
    console.log("Deleting posts...");

    let deleted = 0;
    let failed = 0;

    for (const msg of messages) {

        const success = await deleteMessage(
            msg.messageId
        );

        if (success) {
            deleted++;
        } else {
            failed++;
        }

        process.stdout.write(
            `\r  Deleted: ${deleted} | Failed: ${failed}    `
        );

        // Delay to avoid rate limits
        await new Promise(
            r => setTimeout(r, 200)
        );
    }

    console.log("");
    console.log("");
    console.log("======================================");
    console.log(
        `✅ Done! Deleted: ${deleted} | Failed: ${failed}`
    );
    console.log("======================================");
}

// ===============================
// MAIN MENU
// ===============================

async function main() {

    console.log("");
    console.log("======================================");
    console.log(" Telegram Channel Cleaner 🧹");
    console.log("======================================");
    console.log("");

    // Get latest message ID
    let latestId;

    try {
        latestId = await getLatestMessageId();

        console.log(
            `Latest message ID: ${latestId}`
        );
    } catch (error) {
        console.error(
            `❌ ${error.message}`
        );
        rl.close();
        process.exit(1);
    }

    console.log("");

    while (true) {

        console.log("Choose an option:");
        console.log("");
        console.log("  1. Delete ALL posts");
        console.log("  2. Delete posts OLDER than 48 hours");
        console.log("  3. Delete posts from the LAST 48 hours");
        console.log("  4. Delete posts BEFORE a specific date");
        console.log("  5. Delete posts AFTER a specific date");
        console.log("  6. Filter and delete by KEYWORD");
        console.log("  7. Exit");
        console.log("");

        const choice = await ask("Enter option (1-7): ");

        const now = Math.floor(Date.now() / 1000);

        const hours48 = 48 * 60 * 60;

        switch (choice) {

            case "1": {
                // Delete all posts
                console.log(
                    "\nMode: Delete ALL posts"
                );

                const messages = await scanMessages(
                    latestId,
                    () => true
                );

                await deleteWithConfirmation(messages);
                break;
            }

            case "2": {
                // Older than 48 hours
                console.log(
                    "\nMode: Delete posts OLDER than 48 hours"
                );

                const messages = await scanMessages(
                    latestId,
                    info => info.date < (now - hours48)
                );

                await deleteWithConfirmation(messages);
                break;
            }

            case "3": {
                // Within last 48 hours
                console.log(
                    "\nMode: Delete posts from LAST 48 hours"
                );

                const messages = await scanMessages(
                    latestId,
                    info => info.date >= (now - hours48)
                );

                await deleteWithConfirmation(messages);
                break;
            }

            case "4": {
                // Before a specific date
                const dateStr = await ask(
                    "Enter date (YYYY-MM-DD): "
                );

                const cutoff = new Date(
                    dateStr + "T00:00:00"
                );

                if (isNaN(cutoff.getTime())) {
                    console.log(
                        "❌ Invalid date format."
                    );
                    break;
                }

                const cutoffTs =
                    Math.floor(cutoff.getTime() / 1000);

                console.log(
                    `\nMode: Delete posts BEFORE ${dateStr}`
                );

                const messages = await scanMessages(
                    latestId,
                    info => info.date < cutoffTs
                );

                await deleteWithConfirmation(messages);
                break;
            }

            case "5": {
                // After a specific date
                const dateStr = await ask(
                    "Enter date (YYYY-MM-DD): "
                );

                const cutoff = new Date(
                    dateStr + "T00:00:00"
                );

                if (isNaN(cutoff.getTime())) {
                    console.log(
                        "❌ Invalid date format."
                    );
                    break;
                }

                const cutoffTs =
                    Math.floor(cutoff.getTime() / 1000);

                console.log(
                    `\nMode: Delete posts AFTER ${dateStr}`
                );

                const messages = await scanMessages(
                    latestId,
                    info => info.date >= cutoffTs
                );

                await deleteWithConfirmation(messages);
                break;
            }

            case "6": {
                // Filter by keyword
                const keyword = await ask(
                    "Enter keyword to search for: "
                );

                if (!keyword) {
                    console.log(
                        "❌ No keyword entered."
                    );
                    break;
                }

                const lowerKeyword =
                    keyword.toLowerCase();

                console.log(
                    `\nMode: Delete posts containing "${keyword}"`
                );

                const messages = await scanMessages(
                    latestId,
                    info => info.preview
                        .toLowerCase()
                        .includes(lowerKeyword)
                );

                await deleteWithConfirmation(messages);
                break;
            }

            case "7": {
                console.log("\nBye! 👋");
                rl.close();
                process.exit(0);
            }

            default: {
                console.log(
                    "❌ Invalid option. Try again."
                );
            }
        }

        console.log("");
    }
}

// ===============================
// RUN
// ===============================

main().catch(error => {
    console.error("❌ Fatal error:", error.message);
    rl.close();
    process.exit(1);
});
