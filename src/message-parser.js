function normalizeMessageText(text) {
    if (typeof text !== "string") {
        return "";
    }

    return text.trim();
}

function parseMessageData({ messageId, text } = {}) {
    if (!messageId || typeof messageId !== "string") {
        return null;
    }

    const normalizedText = normalizeMessageText(text);

    if (!normalizedText) {
        return null;
    }

    return {
        messageId,
        text: normalizedText
    };
}

module.exports = {
    normalizeMessageText,
    parseMessageData
};
