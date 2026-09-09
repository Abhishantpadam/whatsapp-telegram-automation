const MAX_TELEGRAM_LENGTH = 4000;

function splitTelegramMessage(text) {
    if (!text || typeof text !== "string") {
        return [];
    }

    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {

        if (remaining.length <= MAX_TELEGRAM_LENGTH) {
            chunks.push(remaining);
            break;
        }

        let splitAt = remaining.lastIndexOf(
            "\n",
            MAX_TELEGRAM_LENGTH
        );

        if (splitAt === -1 || splitAt < 500) {
            splitAt = remaining.lastIndexOf(
                " ",
                MAX_TELEGRAM_LENGTH
            );
        }

        if (splitAt === -1 || splitAt < 500) {
            splitAt = MAX_TELEGRAM_LENGTH;
        }

        chunks.push(
            remaining.substring(0, splitAt)
        );

        remaining =
            remaining
                .substring(splitAt)
                .trimStart();
    }

    return chunks;
}

function addPartIndicators(chunks) {
    if (chunks.length <= 1) {
        return chunks;
    }

    return chunks.map((chunk, index) => {
        return (
            `[Part ${index + 1}/${chunks.length}]\n\n` +
            chunk
        );
    });
}

module.exports = {
    MAX_TELEGRAM_LENGTH,
    splitTelegramMessage,
    addPartIndicators
};
