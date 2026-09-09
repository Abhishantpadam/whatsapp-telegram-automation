const fs = require("fs");
const path = require("path");

const DEFAULT_DATA_DIR = path.join(__dirname, "..", "data");
const DEFAULT_SEEN_MESSAGES_FILE = path.join(
    DEFAULT_DATA_DIR,
    "seen-messages.json"
);

function ensureDataDirectory(dataDir = DEFAULT_DATA_DIR) {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function loadSeenMessages(
    seenMessagesFile = DEFAULT_SEEN_MESSAGES_FILE
) {
    const dataDir = path.dirname(seenMessagesFile);

    ensureDataDirectory(dataDir);

    if (!fs.existsSync(seenMessagesFile)) {
        return new Set();
    }

    try {
        const data = fs.readFileSync(
            seenMessagesFile,
            "utf8"
        );

        const parsed = JSON.parse(data);

        if (!Array.isArray(parsed)) {
            return new Set();
        }

        return new Set(parsed);

    } catch (error) {
        return new Set();
    }
}

function saveSeenMessages(
    knownMessages,
    seenMessagesFile = DEFAULT_SEEN_MESSAGES_FILE
) {
    const dataDir = path.dirname(seenMessagesFile);

    ensureDataDirectory(dataDir);

    const messages = Array.from(knownMessages);

    fs.writeFileSync(
        seenMessagesFile,
        JSON.stringify(messages, null, 2),
        "utf8"
    );
}

function markMessageAsSeen(
    messageId,
    knownMessages,
    seenMessagesFile = DEFAULT_SEEN_MESSAGES_FILE
) {
    knownMessages.add(messageId);

    saveSeenMessages(
        knownMessages,
        seenMessagesFile
    );
}

module.exports = {
    DEFAULT_DATA_DIR,
    DEFAULT_SEEN_MESSAGES_FILE,
    ensureDataDirectory,
    loadSeenMessages,
    saveSeenMessages,
    markMessageAsSeen
};
