const test = require("node:test");
const assert = require("node:assert/strict");

const { loadConfig } = require("../src/config");

test("all required variables present returns config object", () => {
    const mockEnv = {
        TELEGRAM_BOT_TOKEN: "mock_token_123",
        TELEGRAM_CHANNEL_ID: "mock_channel_456",
        TELEGRAM_ADMIN_ID: "mock_admin_789"
    };

    const cfg = loadConfig(mockEnv, true);

    assert.equal(cfg.telegramBotToken, "mock_token_123");
    assert.equal(cfg.telegramChannelId, "mock_channel_456");
    assert.equal(cfg.telegramAdminId, "mock_admin_789");
});

test("missing bot token throws error", () => {
    const mockEnv = {
        TELEGRAM_CHANNEL_ID: "mock_channel_456",
        TELEGRAM_ADMIN_ID: "mock_admin_789"
    };

    assert.throws(
        () => loadConfig(mockEnv),
        /TELEGRAM_BOT_TOKEN is not configured/
    );
});

test("missing channel ID throws error", () => {
    const mockEnv = {
        TELEGRAM_BOT_TOKEN: "mock_token_123",
        TELEGRAM_ADMIN_ID: "mock_admin_789"
    };

    assert.throws(
        () => loadConfig(mockEnv),
        /TELEGRAM_CHANNEL_ID is not configured/
    );
});

test("missing admin ID throws error when admin is required", () => {
    const mockEnv = {
        TELEGRAM_BOT_TOKEN: "mock_token_123",
        TELEGRAM_CHANNEL_ID: "mock_channel_456"
    };

    assert.throws(
        () => loadConfig(mockEnv, true),
        /TELEGRAM_ADMIN_ID is not configured/
    );
});

test("missing admin ID does not throw when admin is not required", () => {
    const mockEnv = {
        TELEGRAM_BOT_TOKEN: "mock_token_123",
        TELEGRAM_CHANNEL_ID: "mock_channel_456"
    };

    const cfg = loadConfig(mockEnv, false);
    assert.equal(cfg.telegramBotToken, "mock_token_123");
    assert.equal(cfg.telegramChannelId, "mock_channel_456");
    assert.equal(cfg.telegramAdminId, undefined);
});
