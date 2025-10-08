import { google } from "googleapis";
import { NextResponse } from "next/server";

// Replace with your sheet ID
const SHEET_ID = "15B0voPZUZDSvtBuCFnGlEGxJ6g3F8fMn9Ib1QS1JNec";
const RANGE = "A1:Z"; // Example: first 3 columns

async function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return auth;
}

export async function GET() {
  try {
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    return NextResponse.json(res.data.values || []);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const {name, rollNo, teamName, attendance1, attendance2, attendance3 } = await req.json();
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGE,
      valueInputOption: "USER_ENTERED",
      requestBody: {
      values: [[name, rollNo, teamName, attendance1, attendance2, attendance3]],
  },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export async function PUT(req) {
  try {
    const { rollNo, attendance1 } = await req.json();
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // Get existing data
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = res.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    // First row is header
    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Find user by Roll No (2nd column)
    const userIndex = dataRows.findIndex((row) => {
      const roll = row[1]?.trim();
      return roll && roll.toLowerCase() === rollNo.toLowerCase();
    });

    if (userIndex === -1) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find Attendance1 column index (case-insensitive)
    const attendanceColIndex = headers.findIndex(
      (h) =>h.replace(/\s+/g, "").toLowerCase() === "attendance1"
    );

    if (attendanceColIndex === -1) {
      return NextResponse.json(
        { error: "Attendance column not found" },
        { status: 400 }
      );
    }

    // Update attendance
    dataRows[userIndex][attendanceColIndex] = attendance1;

    // Write back updated data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `A2:${String.fromCharCode(65 + headers.length - 1)}${rows.length}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: dataRows,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}