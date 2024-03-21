import fs from "fs/promises";
import path from "path";
import process from "process";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "tokens", "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "tokens", "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: "authorized_user",
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

async function getOTPEmail(auth) {
    const gmail = google.gmail({ version: "v1", auth });

    const res = await gmail.users.messages.list({
        userId: "me",
        q: "is:unread from:(noreply-prenotami@esteri.it) OTP code",
    });

    if (res.data.messages) {
        const msg = await gmail.users.messages.get({
            userId: "me",
            id: res.data.messages[0].id,
        });

        return msg.data.snippet.split(":")[1];
    }

    return null;
}

async function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getOTP() {
    const auth = await authorize();

    return new Promise(async (resolve) => {
        let otp;
        while (!otp) {
            otp = await getOTPEmail(auth);

            if (!otp) {
                await pause(5000);
            }
        }

        resolve(otp);
    });
}

export default {
    getOTP,
};
