const { telegramAPI: defaultTelegramAPI } = require("./telegram-api");

async function sendTelegramMessage(
    chunk,
    chatId,
    options = {}
) {
    const api = options.api || defaultTelegramAPI;
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
    const sleep = options.sleep || (ms => new Promise(r => setTimeout(r, ms)));

    let retries = 0;

    while (retries <= maxRetries) {
        const result = await api("sendMessage", {
            chat_id: chatId,
            text: chunk
        });

        if (result.ok) {
            return result;
        }

        if (
            result.error_code === 429 &&
            retries < maxRetries
        ) {
            const waitSec =
                (result.parameters?.retry_after || 30) + 2;

            console.log(
                `⏳ Rate limited. Waiting ${waitSec}s...`
            );

            await sleep(waitSec * 1000);

            retries++;
            continue;
        }

        throw new Error(
            `Telegram API error: ${JSON.stringify(result)}`
        );
    }
}

module.exports = {
    sendTelegramMessage
};
