const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
    loadSeenMessages,
    saveSeenMessages,
    markMessageAsSeen
} = require("../src/message-storage");

function createTestFile() {
    const testDir = fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            "whatsapp-archive-test-"
        )
    );

    return {
        testDir,
        testFile: path.join(
            testDir,
            "seen-messages.json"
        )
    };
}

function cleanupTestDirectory(testDir) {
    fs.rmSync(
        testDir,
        {
            recursive: true,
            force: true
        }
    );
}

test("loadSeenMessages returns empty Set when file does not exist", () => {
    const { testDir, testFile } =
        createTestFile();

    try {
        const messages =
            loadSeenMessages(testFile);

        assert.ok(
            messages instanceof Set
        );

        assert.equal(
            messages.size,
            0
        );

    } finally {
        cleanupTestDirectory(testDir);
    }
});

test("saveSeenMessages persists message IDs", () => {
    const { testDir, testFile } =
        createTestFile();

    try {
        const messages = new Set([
            "conv-msg-001",
            "conv-msg-002"
        ]);

        saveSeenMessages(
            messages,
            testFile
        );

        const saved =
            JSON.parse(
                fs.readFileSync(
                    testFile,
                    "utf8"
                )
            );

        assert.deepEqual(
            saved,
            [
                "conv-msg-001",
                "conv-msg-002"
            ]
        );

    } finally {
        cleanupTestDirectory(testDir);
    }
});

test("loadSeenMessages restores saved message IDs", () => {
    const { testDir, testFile } =
        createTestFile();

    try {
        const messages = new Set([
            "conv-msg-101",
            "conv-msg-102",
            "conv-msg-103"
        ]);

        saveSeenMessages(
            messages,
            testFile
        );

        const loaded =
            loadSeenMessages(testFile);

        assert.ok(
            loaded instanceof Set
        );

        assert.equal(
            loaded.size,
            3
        );

        assert.equal(
            loaded.has("conv-msg-101"),
            true
        );

        assert.equal(
            loaded.has("conv-msg-102"),
            true
        );

        assert.equal(
            loaded.has("conv-msg-103"),
            true
        );

    } finally {
        cleanupTestDirectory(testDir);
    }
});

test("markMessageAsSeen adds and persists message ID", () => {
    const { testDir, testFile } =
        createTestFile();

    try {
        const messages = new Set();

        markMessageAsSeen(
            "conv-msg-999",
            messages,
            testFile
        );

        assert.equal(
            messages.has("conv-msg-999"),
            true
        );

        const loaded =
            loadSeenMessages(testFile);

        assert.equal(
            loaded.has("conv-msg-999"),
            true
        );

    } finally {
        cleanupTestDirectory(testDir);
    }
});

test("duplicate message IDs remain unique", () => {
    const { testDir, testFile } =
        createTestFile();

    try {
        const messages = new Set();

        markMessageAsSeen(
            "conv-msg-duplicate",
            messages,
            testFile
        );

        markMessageAsSeen(
            "conv-msg-duplicate",
            messages,
            testFile
        );

        const loaded =
            loadSeenMessages(testFile);

        const matchingIds =
            Array.from(loaded).filter(
                id =>
                    id === "conv-msg-duplicate"
            );

        assert.equal(
            matchingIds.length,
            1
        );

    } finally {
        cleanupTestDirectory(testDir);
    }
});

test("invalid JSON returns empty Set", () => {
    const { testDir, testFile } =
        createTestFile();

    try {
        fs.writeFileSync(
            testFile,
            "{ invalid json",
            "utf8"
        );

        const messages =
            loadSeenMessages(testFile);

        assert.ok(
            messages instanceof Set
        );

        assert.equal(
            messages.size,
            0
        );

    } finally {
        cleanupTestDirectory(testDir);
    }
});

test("non-array JSON returns empty Set", () => {
    const { testDir, testFile } =
        createTestFile();

    try {
        fs.writeFileSync(
            testFile,
            JSON.stringify({
                message: "invalid format"
            }),
            "utf8"
        );

        const messages =
            loadSeenMessages(testFile);

        assert.ok(
            messages instanceof Set
        );

        assert.equal(
            messages.size,
            0
        );

    } finally {
        cleanupTestDirectory(testDir);
    }
});
