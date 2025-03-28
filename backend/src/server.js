// backend/src/server.js
require('dotenv').config(); // Ensure this is at the very top

const express = require('express');
const path = require('path');
// Note: Vapi is initialized below and also in vapiAgentService. Consider consolidating.
const Vapi = require('@vapi-ai/server-sdk').default;
const twilio = require('twilio');
const axios = require('axios');
// Note: google is initialized below and also in googleSheetsService. Consider consolidating.
const { google } = require('googleapis');

// Import the function to start the calling campaign
const { startCallingCampaign } = require('./vapiAgentService'); // Added import

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize VAPI client
if (!process.env.VAPI_API_KEY) {
  throw new Error('Missing required environment variable: VAPI_API_KEY');
}
const vapi = new Vapi(process.env.VAPI_API_KEY); // This instance might be redundant if vapiAgentService exports its own

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
    // Allow missing numbers if not strictly required for all operations
    console.warn(`Optional environment variable not set: ${phoneVar}`);
    // throw new Error(`Missing required environment variable: ${phoneVar}`); // Original stricter check
  } else {
      twilioNumbers.push(phoneNumber);
  }
}

// Removed the strict check for exactly 10 numbers, adjust if needed
// if (twilioNumbers.length !== 10) {
//   throw new Error('Failed to load all 10 Twilio phone numbers from environment variables.');
// }

let currentNumberIndex = 0;

// Function to get the next number in rotation
function getNextTwilioNumber() {
    if (twilioNumbers.length === 0) {
        console.error("No Twilio numbers loaded to rotate.");
        return null; // Or throw an error
    }
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
    return;
  }
  try {
    console.log('Sending data to Pabbly Connect:', data);
    const response = await axios.post(pabblyWebhookUrl, data);
    console.log('Pabbly Connect response status:', response.status);
  } catch (error) {
    console.error('Error sending data to Pabbly Connect:', error.message);
  }
}

// Function for Go High Level interaction
async function interactWithGHL(action, data) {
  const ghlApiKey = process.env.GHL_API_KEY;
  const ghlApiBaseUrl = 'https://rest.gohighlevel.com/v1'; // Example base URL, adjust if needed

  if (!ghlApiKey) {
    console.error('Missing required environment variable: GHL_API_KEY. Cannot interact with Go High Level.');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${ghlApiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    console.log(`Interacting with Go High Level (${action}):`, data);
    let response;
    if (action === 'addContact') {
      response = await axios.post(`${ghlApiBaseUrl}/contacts/`, data, { headers });
      console.log('GHL Add Contact response status:', response.status);
    }
    // Add other actions here
    else {
      console.warn(`Go High Level action "${action}" not implemented.`);
      return;
    }
  } catch (error) {
    console.error(`Error interacting with Go High Level (${action}):`, error.response ? error.response.data : error.message);
  }
}

// --- Google Sheets Integration ---
// Note: Consider moving this Sheets logic to googleSheetsService.js for consistency

// Authentication setup for Google Sheets API
const sheetsAuth = new google.auth.GoogleAuth({
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
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error('Missing required environment variable: GOOGLE_APPLICATION_CREDENTIALS. Cannot append to Google Sheet.');
      return;
  }

  try {
    console.log(`Appending data to Google Sheet (${spreadsheetId}, Range: ${range}):`, values);
    const response = await sheetsClient.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values,
      },
    });
    console.log('Google Sheets append response:', response.data);
  } catch (error) {
    console.error('Error appending data to Google Sheet:', error.message);
  }
}


// --- Middleware ---
app.use(express.json());

// Serve static files from the frontend build directory
// Assuming webpack builds to 'frontend/dist' - adjust if your webpack.config.js outputs elsewhere
app.use(express.static(path.join(__dirname, '../../frontend/dist')));


// --- API Routes ---
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the Bible Study Tool backend!' });
});

// --- NEW ROUTE: Start Outbound Sales Calls ---
app.post('/api/start-sales-calls', (req, res) => {
  console.log('Received request to start sales calls campaign.');

  // Trigger the campaign function asynchronously.
  // Do not await it here, otherwise the HTTP request will hang until all calls are done.
  startCallingCampaign().catch(error => {
      console.error("Error during calling campaign:", error);
      // Add more robust error handling/logging if needed (e.g., notify admin)
  });

  // Respond immediately to the client
  res.status(202).json({ message: 'Sales calling campaign initiated.' });
});
// --- END NEW ROUTE ---


// Serve the frontend application for any other routes (SPA fallback)
// Ensure this comes after API routes
app.get('*', (req, res) => {
    const frontendIndexPath = path.join(__dirname, '../../frontend/dist', 'index.html');
    // Optional: Check if file exists before sending
    // const fs = require('fs');
    // if (fs.existsSync(frontendIndexPath)) {
       res.sendFile(frontendIndexPath);
    // } else {
    //    res.status(404).send('Frontend not found. Did you run the build?');
    // }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});