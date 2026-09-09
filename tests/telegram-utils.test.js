const test = require("node:test");
const assert = require("node:assert/strict");

const {
    MAX_TELEGRAM_LENGTH,
    splitTelegramMessage,
    addPartIndicators
} = require("../src/telegram-utils");

test("short messages remain as one chunk", () => {
    const text = "Hello Telegram";

    const chunks =
        splitTelegramMessage(text);

    assert.equal(
        chunks.length,
        1
    );

    assert.equal(
        chunks[0],
        text
    );
});

test("empty text returns no chunks", () => {
    assert.deepEqual(
        splitTelegramMessage(""),
        []
    );
});

test("null input returns no chunks", () => {
    assert.deepEqual(
        splitTelegramMessage(null),
        []
    );
});

test("non-string input returns no chunks", () => {
    assert.deepEqual(
        splitTelegramMessage(12345),
        []
    );
});

test("message exactly at Telegram limit remains one chunk", () => {
    const text =
        "A".repeat(
            MAX_TELEGRAM_LENGTH
        );

    const chunks =
        splitTelegramMessage(text);

    assert.equal(
        chunks.length,
        1
    );

    assert.equal(
        chunks[0].length,
        MAX_TELEGRAM_LENGTH
    );
});

test("message longer than Telegram limit is split", () => {
    const text =
        "A".repeat(
            MAX_TELEGRAM_LENGTH + 500
        );

    const chunks =
        splitTelegramMessage(text);

    assert.ok(
        chunks.length > 1
    );

    for (const chunk of chunks) {
        assert.ok(
            chunk.length <= MAX_TELEGRAM_LENGTH
        );
    }
});

test("message prefers newline boundaries", () => {
    const firstPart =
        "A".repeat(1000);

    const secondPart =
        "B".repeat(1000);

    const text =
        firstPart +
        "\n" +
        secondPart +
        "C".repeat(
            MAX_TELEGRAM_LENGTH
        );

    const chunks =
        splitTelegramMessage(text);

    assert.ok(
        chunks.length > 1
    );

    assert.ok(
        chunks[0].includes(
            firstPart
        )
    );
});

test("message prefers spaces when newline is unavailable", () => {
    const text =
        "word ".repeat(1200);

    const chunks =
        splitTelegramMessage(text);

    assert.ok(
        chunks.length > 1
    );

    for (const chunk of chunks) {
        assert.ok(
            chunk.length <= MAX_TELEGRAM_LENGTH
        );
    }
});

test("very long text is hard-cut when no good boundary exists", () => {
    const text =
        "X".repeat(
            MAX_TELEGRAM_LENGTH * 2
        );

    const chunks =
        splitTelegramMessage(text);

    assert.ok(
        chunks.length >= 2
    );

    for (const chunk of chunks) {
        assert.ok(
            chunk.length <= MAX_TELEGRAM_LENGTH
        );
    }
});

test("part indicators are not added to single messages", () => {
    const chunks = [
        "Hello world"
    ];

    const result =
        addPartIndicators(chunks);

    assert.deepEqual(
        result,
        chunks
    );
});

test("part indicators are added to split messages", () => {
    const chunks = [
        "First part",
        "Second part",
        "Third part"
    ];

    const result =
        addPartIndicators(chunks);

    assert.equal(
        result[0],
        "[Part 1/3]\n\nFirst part"
    );

    assert.equal(
        result[1],
        "[Part 2/3]\n\nSecond part"
    );

    assert.equal(
        result[2],
        "[Part 3/3]\n\nThird part"
    );
});
