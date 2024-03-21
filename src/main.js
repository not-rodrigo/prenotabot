import dotenv from "dotenv";

import puppeteer from "puppeteer-extra";
import { getOTP } from "./email.js";

// add stealth plugin and use defaults (all evasion techniques)
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

dotenv.config();
const BASE_URL = "https://prenotami.esteri.it/";

const config = {
    USER: process.env.USER,
    PASS: process.env.PASS,
    START_BOOKING_RETRY: +process.env.START_BOOKING_RETRY || 3,
    WAIT_PER_BOOK_RETRY: +process.env.WAIT_PER_BOOK_RETRY || 1000,
    HEADLESS: process.env.HEADLESS ? process.env.HEADLESS === "true" : true,
    MONTHS_TO_SCRAPE: +process.env.MONTHS_TO_SCRAPE || 3,
    RETRY_PER_MONTH: +process.env.RETRY_PER_MONTH || 3,
    WAIT_PER_MONTH_RETRY: +process.env.WAIT_PER_MONTH_RETRY || 1000,
    SERVICE: process.env.SERVICE,
};

if (!config.USER || !config.PASS) {
    console.error("Usuario o pass no configurados.");
    process.exit(1);
}

if (!config.SERVICE) {
    console.error("No se configuro el servicio en el que buscar el turno");
    process.exit(1);
}

console.log(`Buscando turno para el servicio ${config.SERVICE}`);

async function blockUnnecessaryRequest(page) {
    await page.setRequestInterception(true);

    page.on("request", async (request) => {
        const url = request.url();

        if (
            url.includes("Content") ||
            url.includes("bundles") ||
            url.includes("matomo") ||
            url.includes("Scripts")
        ) {
            await request.abort();
        } else {
            await request.continue();
        }
    });
}

async function main() {
    const browser = await puppeteer.launch({
        headless: config.HEADLESS,
    });

    const page = await browser.newPage();

    await blockUnnecessaryRequest(page);

    // La navegacion no deberia tardar mas de 2 segundos
    const id = setTimeout(async () => {
        await page.evaluate(() => window.stop());
    }, 2000);

    await page.goto(BASE_URL);
    clearTimeout(id);

    // Login
    await page.waitForSelector('[name="Email"]');
    await page.type('[name="Email"]', process.env.USER);
    await page.type('[name="Password"]', process.env.PASS);
    await page.click('[type="submit"]');

    await page.waitForSelector("[href='/Services']");

    await page.addScriptTag({
        content: `
            window.START_BOOKING_RETRY = ${config.START_BOOKING_RETRY};
            window.WAIT_PER_BOOK_RETRY = ${config.WAIT_PER_BOOK_RETRY};
            window.MONTHS_TO_SCRAPE = ${config.MONTHS_TO_SCRAPE};
            window.RETRY_PER_MONTH = ${config.RETRY_PER_MONTH};
            window.WAIT_PER_MONTH_RETRY = ${config.WAIT_PER_MONTH_RETRY};
        `,
    });

    await page.addScriptTag({
        path: "./src/api.js",
    });

    const { error: slotError, slot } = await page.evaluate(async (service) => {
        try {
            await window.startBooking(service);
            await window.getServerInfo();
            const slot = await window.getFreeSlot(service);
            return { slot, error: null };
        } catch (e) {
            return { slot: null, error: String(e) };
        }
    }, config.SERVICE);

    if (slotError || !slot) {
        console.error(slotError || "Sin turnos");
        process.exit(1);
    }

    const { error: otpError } = await page.evaluate(async (service) => {
        try {
            const result = await window.generateOTP();
            return { result, error: null };
        } catch (e) {
            return { result: null, error: String(e) };
        }
    });

    if (otpError) {
        console.error(otpError);
        process.exit(1);
    }

    const otp = await getOTP();

    const { error: bookError, result } = await page.evaluate(
        async (service, otp, slot) => {
            try {
                const result = await window.book(slot, otp);
                return { result, error: null };
            } catch (e) {
                return { result: null, error: String(e) };
            }
        },
        config.SERVICE,
        otp,
        slot[0]
    );

    if (bookError) {
        console.error(bookError);
        process.exit(1);
    }

    if (result) {
        console.log("Turno reservado");
    }

    await browser.close();
}

main();
