const test = require("node:test");
const assert = require("node:assert/strict");

const {
    normalizeMessageText,
    parseMessageData
} = require("../src/message-parser");

test("valid message produces { messageId, text }", () => {
    const result = parseMessageData({
        messageId: "conv-msg-12345",
        text: "New job referral posting"
    });

    assert.deepEqual(result, {
        messageId: "conv-msg-12345",
        text: "New job referral posting"
    });
});

test("whitespace is trimmed", () => {
    const result = parseMessageData({
        messageId: "conv-msg-12345",
        text: "   Leading and trailing whitespace   \n"
    });

    assert.equal(result.text, "Leading and trailing whitespace");
});

test("empty text returns null", () => {
    const result = parseMessageData({
        messageId: "conv-msg-12345",
        text: ""
    });

    assert.equal(result, null);
});

test("whitespace-only text returns null", () => {
    const result = parseMessageData({
        messageId: "conv-msg-12345",
        text: "   \n\t   "
    });

    assert.equal(result, null);
});

test("missing messageId returns null", () => {
    const result = parseMessageData({
        text: "Some text without an ID"
    });

    assert.equal(result, null);
});

test("empty messageId returns null", () => {
    const result = parseMessageData({
        messageId: "",
        text: "Some valid text"
    });

    assert.equal(result, null);
});

test("non-string messageId returns null", () => {
    const result = parseMessageData({
        messageId: 12345,
        text: "Some valid text"
    });

    assert.equal(result, null);
});

test("non-string text returns null", () => {
    const result = parseMessageData({
        messageId: "conv-msg-12345",
        text: 99999
    });

    assert.equal(result, null);
});
