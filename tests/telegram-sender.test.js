const test = require("node:test");
const assert = require("node:assert/strict");

const { sendTelegramMessage } = require("../src/telegram-sender");

test("successful send makes one API call and returns result", async () => {
    let callCount = 0;
    const mockApi = async (method, params) => {
        callCount++;
        assert.equal(method, "sendMessage");
        assert.equal(params.chat_id, "12345");
        assert.equal(params.text, "Hello World");
        return { ok: true, result: { message_id: 101 } };
    };

    const result = await sendTelegramMessage("Hello World", "12345", {
        api: mockApi
    });

    assert.equal(callCount, 1);
    assert.equal(result.ok, true);
    assert.equal(result.result.message_id, 101);
});

test("429 rate limit triggers wait and retries", async () => {
    let callCount = 0;
    let sleepMsRecorded = [];

    const mockApi = async () => {
        callCount++;
        if (callCount <= 2) {
            return {
                ok: false,
                error_code: 429,
                parameters: { retry_after: 5 }
            };
        }
        return { ok: true, result: { message_id: 102 } };
    };

    const mockSleep = async (ms) => {
        sleepMsRecorded.push(ms);
    };

    const result = await sendTelegramMessage("Rate limit test", "12345", {
        api: mockApi,
        sleep: mockSleep
    });

    assert.equal(callCount, 3);
    assert.equal(result.ok, true);
    assert.equal(sleepMsRecorded.length, 2);
    // 5s + 2s buffer = 7000ms
    assert.equal(sleepMsRecorded[0], 7000);
    assert.equal(sleepMsRecorded[1], 7000);
});

test("429 followed by success succeeds", async () => {
    let callCount = 0;

    const mockApi = async () => {
        callCount++;
        if (callCount === 1) {
            return {
                ok: false,
                error_code: 429,
                parameters: { retry_after: 1 }
            };
        }
        return { ok: true, result: { message_id: 200 } };
    };

    const result = await sendTelegramMessage("Retry once", "12345", {
        api: mockApi,
        sleep: async () => {}
    });

    assert.equal(callCount, 2);
    assert.equal(result.ok, true);
});

test("non-429 failure throws without retrying", async () => {
    let callCount = 0;

    const mockApi = async () => {
        callCount++;
        return {
            ok: false,
            error_code: 400,
            description: "Bad Request: chat not found"
        };
    };

    await assert.rejects(
        async () => {
            await sendTelegramMessage("Invalid chat", "999", {
                api: mockApi,
                sleep: async () => {}
            });
        },
        /Telegram API error:.*400/
    );

    assert.equal(callCount, 1);
});

test("retries exhausted throws error", async () => {
    let callCount = 0;

    const mockApi = async () => {
        callCount++;
        return {
            ok: false,
            error_code: 429,
            parameters: { retry_after: 2 }
        };
    };

    await assert.rejects(
        async () => {
            await sendTelegramMessage("Persistent 429", "12345", {
                api: mockApi,
                maxRetries: 2,
                sleep: async () => {}
            });
        },
        /Telegram API error:.*429/
    );

    // Initial attempt + 2 retries = 3 calls
    assert.equal(callCount, 3);
});
