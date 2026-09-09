const config = require("./config");

async function telegramAPI(
    method,
    params = {},
    token = config.telegramBotToken
) {
    if (!token) {
        throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const url = `https://api.telegram.org/bot${token}/${method}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params)
    });

    return await response.json();
}

module.exports = {
    telegramAPI
};
