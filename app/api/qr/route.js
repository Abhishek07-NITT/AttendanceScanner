import QRCode from "qrcode";
import { google } from "googleapis";
import crypto from "crypto";

const RANGE = "A1:Z"; // Adjust range as needed

async function getAuth() {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const cleanedKey = rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key: cleanedKey,
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
    const targetSheetId = process.env.SHEET_ID || "1ZlnHaUdnEfEvu1TkG77yzlEmLTnMScaphN2R0ww1O2E";

    // Get sheet data
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSheetId,
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

    const userId = user.user_id || user.rollNo || user.RollNo || userRow[1] || "";
    const userName = user.user_name || user.name || user.Name || userRow[2] || userRow[1] || "";
    const teamId = user.team_id || user.Team || user["Team name"] || userRow[0] || "";

    const secretString = process.env.SECRET_STRING || "transfinitte-26-secret-key";
    const signature = crypto
      .createHmac("sha256", secretString)
      .update(`${userId.toString().trim()}:${teamId.toString().trim()}:${userName.toString().trim()}`)
      .digest("hex")
      .slice(0, 12);

    const qrPayload = `${userId},${userName},${teamId},${signature}`;
    // Convert formatted details to QR Code
    const qrData = await QRCode.toDataURL(qrPayload);

    return new Response(JSON.stringify({ user, qrCode: qrData, qrPayload }), {
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