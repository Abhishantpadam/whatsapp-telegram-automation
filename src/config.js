require("dotenv").config();

function requireEnv(name, env = process.env) {
    const value = env[name];

    if (!value) {
        throw new Error(`${name} is not configured`);
    }

    return value;
}

function loadConfig(env = process.env, requireAdmin = false) {
    const cfg = {
        telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN", env),
        telegramChannelId: requireEnv("TELEGRAM_CHANNEL_ID", env)
    };

    if (requireAdmin) {
        cfg.telegramAdminId = requireEnv("TELEGRAM_ADMIN_ID", env);
    } else if (env.TELEGRAM_ADMIN_ID) {
        cfg.telegramAdminId = env.TELEGRAM_ADMIN_ID;
    }

    return cfg;
}

const config = {
    get telegramBotToken() {
        return requireEnv("TELEGRAM_BOT_TOKEN");
    },
    get telegramChannelId() {
        return requireEnv("TELEGRAM_CHANNEL_ID");
    },
    get telegramAdminId() {
        return requireEnv("TELEGRAM_ADMIN_ID");
    },
    loadConfig,
    requireEnv
};

module.exports = config;
