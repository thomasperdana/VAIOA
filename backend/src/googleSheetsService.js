// backend/src/googleSheetsService.js
require('dotenv').config();
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheetName = process.env.GOOGLE_SHEET_NAME;
const sheetRange = process.env.GOOGLE_SHEET_RANGE; // e.g., 'Sheet1!A2:E' or just 'A2:E' if sheetName is provided separately

if (!spreadsheetId || !sheetName || !sheetRange) {
    console.error('Missing Google Sheets configuration in .env file (GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME, GOOGLE_SHEET_RANGE)');
    // Optionally exit or throw an error depending on desired behavior
    // process.exit(1);
}

// Ensure GOOGLE_APPLICATION_CREDENTIALS is set in your environment
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Missing GOOGLE_APPLICATION_CREDENTIALS environment variable. Please set the path to your service account key file.');
    // process.exit(1);
}

const auth = new GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Read-only scope
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Fetches client data from the configured Google Sheet.
 * Assumes the first row contains headers and actual data starts from the second row.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of client objects,
 * where keys are header names and values are cell contents. Returns empty array on error or if no data.
 */
async function getClientData() {
    console.log(`Fetching data from Sheet ID: ${spreadsheetId}, Name: ${sheetName}, Range: ${sheetRange}`);
    try {
        // Construct the full range including the sheet name
        const fullRange = `${sheetName}!${sheetRange}`;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: fullRange,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) { // Need at least header row + 1 data row
            console.log('No data found in the specified sheet range.');
            return [];
        }

        // Assume first row is header
        const headers = rows[0].map(header => header.trim().toLowerCase().replace(/\s+/g, '_')); // Normalize headers
        const data = rows.slice(1).map(row => {
            let client = {};
            headers.forEach((header, index) => {
                client[header] = row[index] || ''; // Assign value or empty string if cell is empty
            });
            return client;
        });

        console.log(`Successfully fetched ${data.length} client records.`);
        return data;

    } catch (err) {
        console.error('Error fetching data from Google Sheets:', err.message);
        if (err.response && err.response.data && err.response.data.error) {
            console.error('Google API Error Details:', err.response.data.error);
        }
        return []; // Return empty array on error
    }
}

module.exports = {
    getClientData,
};