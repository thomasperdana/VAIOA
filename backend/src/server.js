const express = require('express');
const path = require('path');
const Vapi = require('@vapi-ai/server-sdk');
const twilio = require('twilio');
const axios = require('axios');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize VAPI client
if (!process.env.VAPI_API_KEY) {
  throw new Error('Missing required environment variable: VAPI_API_KEY');
}
const vapi = new Vapi(process.env.VAPI_API_KEY);

// Initialize Twilio client
if (!process.env.TWILIO_ACCOUNT_SID) {
  throw new Error('Missing required environment variable: TWILIO_ACCOUNT_SID');
}
if (!process.env.TWILIO_AUTH_TOKEN) {
  throw new Error('Missing required environment variable: TWILIO_AUTH_TOKEN');
}
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);

// Check and load Twilio phone numbers from environment variables
const twilioNumbers = [];
for (let i = 1; i <= 10; i++) {
  const phoneVar = `TWILIO_PHONE_${i}`;
  const phoneNumber = process.env[phoneVar];
  if (!phoneNumber) {
    throw new Error(`Missing required environment variable: ${phoneVar}`);
  }
  twilioNumbers.push(phoneNumber);
}

if (twilioNumbers.length !== 10) {
  // This check is somewhat redundant due to the loop check, but good for extra safety
  throw new Error('Failed to load all 10 Twilio phone numbers from environment variables.');
}

let currentNumberIndex = 0;

// Function to get the next number in rotation
function getNextTwilioNumber() {
  const number = twilioNumbers[currentNumberIndex];
  currentNumberIndex = (currentNumberIndex + 1) % twilioNumbers.length;
  return number;
}

// --- Integration Functions ---

// Function to send data to Pabbly Connect Webhook
async function sendToPabbly(data) {
  const pabblyWebhookUrl = process.env.PABBLY_WEBHOOK_URL;
  if (!pabblyWebhookUrl) {
    console.error('Missing required environment variable: PABBLY_WEBHOOK_URL. Cannot send data.');
    // Depending on requirements, you might throw an error or just log and return
    return;
  }
  try {
    console.log('Sending data to Pabbly Connect:', data);
    const response = await axios.post(pabblyWebhookUrl, data);
    console.log('Pabbly Connect response status:', response.status);
  } catch (error) {
    console.error('Error sending data to Pabbly Connect:', error.message);
    // Handle error appropriately
  }
}

// Function for Go High Level interaction
async function interactWithGHL(action, data) {
  const ghlApiKey = process.env.GHL_API_KEY;
  const ghlApiBaseUrl = 'https://rest.gohighlevel.com/v1'; // Example base URL, adjust if needed

  if (!ghlApiKey) {
    console.error('Missing required environment variable: GHL_API_KEY. Cannot interact with Go High Level.');
    // Depending on requirements, you might throw an error or just log and return
    return;
  }

  const headers = {
    'Authorization': `Bearer ${ghlApiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    console.log(`Interacting with Go High Level (${action}):`, data);
    let response;
    // Example: Add contact
    if (action === 'addContact') {
      // Adjust endpoint and payload as per GHL API docs
      response = await axios.post(`${ghlApiBaseUrl}/contacts/`, data, { headers });
      console.log('GHL Add Contact response status:', response.status);
    }
    // Add other actions (e.g., update contact, add note) here
    else {
      console.warn(`Go High Level action "${action}" not implemented.`);
      return;
    }
    // Handle response
  } catch (error) {
    console.error(`Error interacting with Go High Level (${action}):`, error.response ? error.response.data : error.message);
    // Handle error appropriately
  }
}

// --- Google Sheets Integration ---

// Authentication setup for Google Sheets API
const sheetsAuth = new google.auth.GoogleAuth({
  // Scopes required for Google Sheets API
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  // GOOGLE_APPLICATION_CREDENTIALS environment variable should point to your service account key file
});
const sheetsClient = google.sheets({ version: 'v4', auth: sheetsAuth });

// Placeholder function to append data to a Google Sheet
async function appendToSheet(spreadsheetId, range, values) {
  if (!spreadsheetId || !range || !values) {
    console.error('Missing required parameters for appendToSheet');
    return;
  }
  // Ensure GOOGLE_APPLICATION_CREDENTIALS is set
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error('Missing required environment variable: GOOGLE_APPLICATION_CREDENTIALS. Cannot append to Google Sheet.');
      // Prevent execution if auth is missing
      return;
  }

  try {
    console.log(`Appending data to Google Sheet (${spreadsheetId}, Range: ${range}):`, values);
    const response = await sheetsClient.spreadsheets.values.append({
      spreadsheetId: spreadsheetId, // The ID of the spreadsheet
      range: range, // The A1 notation of a range to search for a logical table of data. Values will be appended after the last row of the table. e.g., 'Sheet1!A1'
      valueInputOption: 'USER_ENTERED', // How the input data should be interpreted.
      insertDataOption: 'INSERT_ROWS', // How the input data should be inserted.
      resource: {
        values: values, // Array of arrays: [[row1_col1, row1_col2], [row2_col1, row2_col2]]
      },
    });
    console.log('Google Sheets append response:', response.data);
  } catch (error) {
    console.error('Error appending data to Google Sheet:', error.message);
    // Handle error appropriately
  }
}


// --- Middleware ---
// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the frontend build directory
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Basic API endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the Bible Study Tool backend!' });
});

// Serve the frontend application for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});