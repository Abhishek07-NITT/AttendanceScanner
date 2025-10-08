import QRCode from "qrcode";
import { google } from "googleapis";

const SHEET_ID = "15B0voPZUZDSvtBuCFnGlEGxJ6g3F8fMn9Ib1QS1JNec";
const RANGE = "A1:Z"; // Adjust range as needed

async function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return auth;
}

export async function POST(request) {
  try {
    const { rollNo } = await request.json(); // user search input

    if (!rollNo) {
      return new Response(JSON.stringify({ error: "No roll number provided" }), {
        status: 400,
      });
    }

    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // Get sheet data
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = res.data.values || [];
    if (rows.length < 2) {
      return new Response(JSON.stringify({ error: "No user data found" }), {
        status: 404,
      });
    }

    // First row is header
    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Search user by roll number (case insensitive)
    const userRow = dataRows.find(
      (row) => row[1]?.toLowerCase() === rollNo.toLowerCase()
    );

    if (!userRow) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });
    }

    // Build user object (map headers → values)
    const user = headers.reduce((obj, key, index) => {
      obj[key] = userRow[index] || "";
      return obj;
    }, {});

    // Convert user details to QR Code
    const qrData = await QRCode.toDataURL(JSON.stringify(user));

    return new Response(JSON.stringify({ user, qrCode: qrData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating QR:", error);
    return new Response(JSON.stringify({ error: "Failed to generate QR" }), {
      status: 500,
    });
  }
}