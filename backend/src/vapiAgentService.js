// backend/src/vapiAgentService.js
require('dotenv').config();
const Vapi = require('@vapi-ai/server-sdk').default;
const { getClientData } = require('./googleSheetsService');

const vapiApiKey = process.env.VAPI_API_KEY;
const vapiPhoneNumberId = process.env.VAPI_PHONE_NUMBER_ID; // VAPI Phone Number ID for outbound calls

if (!vapiApiKey || !vapiPhoneNumberId) {
    console.error('Missing VAPI configuration in .env file (VAPI_API_KEY, VAPI_PHONE_NUMBER_ID)');
    // process.exit(1);
}

const vapi = new Vapi(vapiApiKey);

// --- Agent Configuration ---
// TODO: Customize these details based on your specific product/service and sales strategy
const YOUR_PRODUCT_NAME = "Our Awesome Product/Service";
const YOUR_COMPANY_NAME = "Our Company";
const KEY_BENEFITS = [
    "Saves you time",
    "Increases your revenue",
    "Simplifies your workflow"
];
const OFFER_DETAILS = "We have a special introductory offer available this month.";
const CALL_GOAL = "Determine if the potential client is interested in learning more and potentially schedule a brief follow-up call or demo.";

// Define the VAPI Assistant configuration
const assistantConfig = {
    name: "Sales Development Representative",
    model: {
        provider: "openai", // or other providers like groq, anthropic
        model: "gpt-3.5-turbo", // Choose appropriate model
        temperature: 0.7,
        // System prompt defining the agent's role and behavior
        systemPrompt: `You are a friendly and professional Sales Development Representative (SDR) for ${YOUR_COMPANY_NAME}.
Your goal is to make outbound cold calls to potential clients listed in a database.
Your primary objective is: ${CALL_GOAL}.

Product/Service: ${YOUR_PRODUCT_NAME}
Key Benefits: ${KEY_BENEFITS.join(', ')}.
Offer: ${OFFER_DETAILS}

Conversation Flow:
1. Introduction: Introduce yourself and ${YOUR_COMPANY_NAME}. Briefly state the reason for your call (e.g., "calling businesses in your industry that might benefit from...").
2. Qualification/Discovery: Ask questions to understand their current situation, needs, and if ${YOUR_PRODUCT_NAME} could be a good fit. Listen more than you talk.
3. Value Proposition: Briefly explain how ${YOUR_PRODUCT_NAME} addresses their potential needs, highlighting relevant benefits (${KEY_BENEFITS.join(', ')}).
4. Handle Objections: Address any concerns or questions professionally.
5. Call to Action: Based on the conversation, attempt to achieve the call goal (${CALL_GOAL}). If they are interested, suggest next steps (e.g., scheduling a 15-minute demo, sending more information). If not interested, thank them for their time politely.
6. Closing: End the call professionally.

Guidelines:
- Be polite, respectful, and empathetic.
- Do not be pushy.
- Keep the initial part of the call concise.
- Adapt to the client's responses.
- If asked a question you don't know, politely state you'll find out and follow up.
- Use the client's name if available.`,
    },
    voice: {
        provider: "11labs", // or other providers like deepgram, playht
        voiceId: "josh", // Choose a suitable voice
    },
    firstMessage: `Hi, is this [Client Name]? This is [Your Agent Name] calling from ${YOUR_COMPANY_NAME}. How are you today?`, // Vapi replaces placeholders like [Client Name]
    // You might add functions here later for CRM integration, scheduling, etc.
    // functions: [],
    // Configure the phone number for outbound calls
    phoneNumberId: vapiPhoneNumberId,
    // Recording can be enabled if needed
    // recordingEnabled: true,
};

/**
 * Initiates an outbound call to a specific client using VAPI.
 * @param {object} client - The client object (e.g., from Google Sheets). Must include 'phone_number' and potentially 'name'.
 * @returns {Promise<object|null>} A promise that resolves to the VAPI call object on success, or null on error.
 */
async function makeOutboundCall(client) {
    if (!client || !client.phone_number) {
        console.error('Invalid client object or missing phone number.');
        return null;
    }

    // Ensure phone number is in E.164 format (e.g., +15551234567)
    // Basic check/formatting - might need a more robust library for real-world use
    let phoneNumber = client.phone_number.replace(/[^+\d]/g, ''); // Remove non-digit/non-+ chars
    if (!phoneNumber.startsWith('+')) {
        // Assuming US numbers if no country code - adjust as needed
        if (phoneNumber.length === 10) {
            phoneNumber = `+1${phoneNumber}`;
        } else {
            console.error(`Invalid phone number format for VAPI: ${client.phone_number}. Needs E.164 format.`);
            return null;
        }
    }

    console.log(`Initiating outbound call to ${client.name || 'client'} at ${phoneNumber}...`);

    try {
        // Pass client details to Vapi. Variables can be used in prompts/firstMessage
        const call = await vapi.call.create({
            assistant: {
                ...assistantConfig,
                // Override firstMessage to include dynamic client name if available
                firstMessage: `Hi, is this ${client.name || 'available'}? This is [Your Agent Name] calling from ${YOUR_COMPANY_NAME}. How are you today?`,
            },
            phoneNumberId: vapiPhoneNumberId, // Redundant? Already in assistantConfig, but API might require it top-level too. Check VAPI docs.
            customer: {
                number: phoneNumber,
            },
            // Pass additional variables accessible in the assistant prompt/functions
            assistantOverrides: {
                variables: {
                    clientName: client.name || "there", // Provide a fallback
                    // Add other client details from the sheet if needed
                    // clientCompany: client.company_name || "",
                    // clientIndustry: client.industry || "",
                }
            }
        });
        console.log('Call initiated successfully:', call.id);
        return call;
    } catch (error) {
        console.error(`Error initiating VAPI call to ${phoneNumber}:`, error.message);
        if (error.response && error.response.data) {
            console.error("VAPI Error Details:", error.response.data);
        }
        return null;
    }
}

/**
 * Fetches clients from Google Sheets and initiates calls sequentially.
 * Basic implementation - consider adding delays, error handling, status tracking.
 */
async function startCallingCampaign() {
    console.log("Starting outbound calling campaign...");
    const clients = await getClientData();

    if (!clients || clients.length === 0) {
        console.log("No clients found to call.");
        return;
    }

    console.log(`Found ${clients.length} clients. Starting calls...`);

    // Simple sequential calling - improve with concurrency control, delays, etc.
    for (const client of clients) {
        // Basic check for a phone number before attempting call
        if (client.phone_number && client.phone_number.trim() !== '') {
            const callResult = await makeOutboundCall(client);
            if (callResult) {
                console.log(`Call to ${client.phone_number} initiated (ID: ${callResult.id}). Waiting before next call...`);
                // Add a delay between calls to avoid overwhelming systems or rate limits
                await new Promise(resolve => setTimeout(resolve, 5000)); // 5-second delay
            } else {
                console.log(`Failed to initiate call to ${client.phone_number}. Skipping.`);
                // Optionally add more robust error handling or retry logic here
            }
        } else {
            console.log(`Skipping client ${client.name || 'N/A'} due to missing phone number.`);
        }
    }

    console.log("Calling campaign finished.");
}

// Optional: Set up VAPI event listeners if needed
// vapi.on('call-start', (call) => console.log('Call started:', call.id));
// vapi.on('call-end', (call) => console.log('Call ended:', call.id));
// vapi.on('function-call', (payload) => { /* Handle function calls */ });

module.exports = {
    makeOutboundCall,
    startCallingCampaign,
    vapi // Export vapi instance if needed elsewhere
};