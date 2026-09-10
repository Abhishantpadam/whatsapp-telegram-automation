const { chromium } = require("playwright");

const WHATSAPP_URL = "https://web.whatsapp.com";

async function launchWhatsApp(options = {}) {
    const {
        profilePath,
        headless = false,
        viewport = { width: 1400, height: 900 }
    } = options;

    const context = await chromium.launchPersistentContext(
        profilePath,
        {
            headless,
            viewport
        }
    );

    const page =
        context.pages()[0] ||
        (await context.newPage());

    await page.goto(WHATSAPP_URL);
    await page.waitForTimeout(5000);

    return {
        context,
        page
    };
}

async function isChannelOpen(page, targetChannel) {
    try {
        const bodyText = await page.locator("body").innerText();
        return bodyText.includes(targetChannel);
    } catch {
        return false;
    }
}

async function waitForChannel(page, targetChannel) {
    while (!(await isChannelOpen(page, targetChannel))) {
        await page.waitForTimeout(2000);
    }
}

async function getExistingMessageIds(page) {
    try {
        return await page
            .locator('[data-testid^="conv-msg-"]')
            .evaluateAll((elements) =>
                elements
                    .map((element) => element.getAttribute("data-testid"))
                    .filter(Boolean)
            );
    } catch {
        return [];
    }
}

async function expandReadMore(messageLocator, customPage = null) {
    try {
        const page =
            customPage ||
            (typeof messageLocator.page === "function"
                ? messageLocator.page()
                : null);

        // 1. Check if the message contains "Read more"
        const initialText = await messageLocator
            .innerText({ timeout: 2500 })
            .catch(() => "");

        if (!/read more/i.test(initialText)) {
            return false;
        }

        console.log("  🔍 Truncated post detected with 'Read more'. Expanding...");

        // Ensure message is scrolled into view
        await messageLocator.scrollIntoViewIfNeeded().catch(() => {});
        if (page) {
            await page.waitForTimeout(300);
        }

        // 2. Candidate locators targeting innermost button element (.last() picks innermost)
        const candidates = [
            messageLocator.getByText(/read more/i).last(),
            messageLocator.locator('[role="button"]:has-text("Read more")').last(),
            messageLocator.locator('button:has-text("Read more")').last(),
            messageLocator.locator('[data-testid="read-more"]').last(),
            messageLocator.locator('span[role="button"]:has-text("Read more")').last(),
            messageLocator.locator('div[role="button"]:has-text("Read more")').last(),
            messageLocator.locator('span:has-text("Read more")').last()
        ];

        for (const candidate of candidates) {
            try {
                if (
                    await candidate
                        .isVisible({ timeout: 1000 })
                        .catch(() => false)
                ) {
                    await candidate.scrollIntoViewIfNeeded().catch(() => {});

                    // Primary: Playwright CDP click (hardware input)
                    await candidate
                        .click({ timeout: 2000, force: true })
                        .catch(() => {});

                    // Secondary: Dispatch full mouse/pointer events to trigger React synthetic events
                    await candidate
                        .evaluate((el) => {
                            const eventTypes = [
                                "pointerdown",
                                "mousedown",
                                "pointerup",
                                "mouseup",
                                "click"
                            ];
                            for (const type of eventTypes) {
                                el.dispatchEvent(
                                    new MouseEvent(type, {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window
                                    })
                                );
                            }
                        })
                        .catch(() => {});

                    // Poll to verify if text expanded
                    for (let attempt = 0; attempt < 5; attempt++) {
                        if (page) {
                            await page.waitForTimeout(400);
                        } else {
                            await new Promise((r) => setTimeout(r, 400));
                        }
                        const currentText = await messageLocator
                            .innerText()
                            .catch(() => "");
                        if (!/read more/i.test(currentText)) {
                            console.log(
                                "  ✅ Successfully expanded 'Read more'!"
                            );
                            return true;
                        }
                    }
                }
            } catch {
                // Continue to next candidate
            }
        }

        // 3. Fallback: DOM traversal finding innermost element with "read more"
        const domResult = await messageLocator
            .evaluate((msgEl) => {
                const all = Array.from(msgEl.querySelectorAll("*"));
                const matching = all.filter((el) =>
                    /read more/i.test(el.textContent || "")
                );
                const buttonEl =
                    matching.reverse().find(
                        (el) =>
                            el.getAttribute("role") === "button" ||
                            el.tagName === "BUTTON" ||
                            /^(…|\.\.\.)?\s*read more$/i.test(
                                (el.textContent || "").trim()
                            )
                    ) || matching[0];

                if (buttonEl) {
                    buttonEl.scrollIntoView?.({ block: "center" });
                    const eventTypes = [
                        "pointerdown",
                        "mousedown",
                        "pointerup",
                        "mouseup",
                        "click"
                    ];
                    for (const type of eventTypes) {
                        buttonEl.dispatchEvent(
                            new MouseEvent(type, {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            })
                        );
                    }
                    buttonEl.click?.();
                    return true;
                }
                return false;
            })
            .catch(() => false);

        if (domResult) {
            if (page) {
                await page.waitForTimeout(800);
            } else {
                await new Promise((r) => setTimeout(r, 800));
            }
            const finalText = await messageLocator
                .innerText()
                .catch(() => "");
            if (!/read more/i.test(finalText)) {
                console.log(
                    "  ✅ Successfully expanded 'Read more' via DOM fallback!"
                );
                return true;
            }
        }

        console.log(
            "  ⚠️ Could not expand 'Read more' after trying all strategies."
        );
        return false;
    } catch (err) {
        console.log("  ⚠️ Error in expandReadMore:", err.message);
        return false;
    }
}

async function getRawMessage(messageLocator) {
    const messageId = await messageLocator.getAttribute(
        "data-testid",
        { timeout: 1500 }
    );

    if (!messageId) {
        return null;
    }

    await expandReadMore(messageLocator);

    const text = await messageLocator.innerText();

    return {
        messageId,
        text
    };
}

function getMessageLocators(page) {
    return page.locator('[data-testid^="conv-msg-"]');
}

module.exports = {
    WHATSAPP_URL,
    launchWhatsApp,
    isChannelOpen,
    waitForChannel,
    getExistingMessageIds,
    expandReadMore,
    getRawMessage,
    getMessageLocators
};
