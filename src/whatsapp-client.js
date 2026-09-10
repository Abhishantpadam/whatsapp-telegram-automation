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

async function expandReadMore(messageLocator) {
    try {
        // 1. Try DOM evaluation first to find and click the innermost "Read more" button
        const expandedViaDom = await messageLocator.evaluate((msgEl) => {
            const allElements = Array.from(msgEl.querySelectorAll("*"));
            const candidates = allElements.filter((el) => {
                const text = (el.textContent || "").trim();
                return /read more/i.test(text);
            });

            // Innermost elements come last in document order among descendants
            const buttonEl = candidates.reverse().find((el) => {
                const text = (el.textContent || "").trim();
                return (
                    el.getAttribute("role") === "button" ||
                    el.tagName === "BUTTON" ||
                    /^(…|\.\.\.)?\s*read more$/i.test(text)
                );
            });

            if (buttonEl) {
                buttonEl.scrollIntoView?.({ block: "center" });
                buttonEl.click();
                return true;
            }
            return false;
        });

        if (expandedViaDom) {
            await new Promise((r) => setTimeout(r, 800));
            return;
        }

        // 2. Fallback: targeted Playwright locators (preferring role="button" over general spans)
        const selectors = [
            '[role="button"]:has-text("Read more")',
            'button:has-text("Read more")',
            '[data-testid="read-more"]',
            'span[role="button"]:has-text("Read more")'
        ];

        for (const sel of selectors) {
            const btn = messageLocator.locator(sel);

            if ((await btn.count()) > 0) {
                await btn.first().scrollIntoViewIfNeeded();
                await btn.first().click({ force: true });
                await new Promise((r) => setTimeout(r, 800));
                break;
            }
        }
    } catch {
        // Ignore if "Read more" click fails
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
