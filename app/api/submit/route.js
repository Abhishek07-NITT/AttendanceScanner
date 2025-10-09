import { google } from "googleapis";
import { NextResponse } from "next/server";

const SHEET_ID = process.env.SHEET_ID; // spreadsheet ID from .env
const RANGE = "A1:Z"; // read enough columns

// Authenticate using Google Service Account
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

// Convert numeric column (1-based) → letter (A, B, C...)
function colNumberToLetter(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || "A";
}

// POST: expects { qr: "user_id,user_name,team_id,SECRET", attendanceIndex?: number }
export async function POST(req) {
  try {
    const body = await req.json();
    const qrRaw = body.qr;
    const attendanceIndex = body.attendanceIndex ?? 1; // default to 1

    if (!qrRaw || typeof qrRaw !== "string") {
      return NextResponse.json({ error: "Missing qr payload" }, { status: 400 });
    }

    // Robust parsing: user_id, user_name (may contain commas), team_id, secret
    const parts = qrRaw.split(",").map((p) => p.trim());
    if (parts.length < 4) {
      return NextResponse.json({ error: "Invalid QR format" }, { status: 400 });
    }

    const secret = parts[parts.length - 1];
    const team_id = parts[parts.length - 2];
    const user_id = parts[0];
    const user_name = parts.slice(1, parts.length - 2).join(",").trim();

    // Validate secret
    if (secret !== process.env.SECRET_STRING) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
    }

    // Connect to Sheets
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // Read current sheet
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "Sheet is empty" }, { status: 404 });
    }

    // Find the row where first column == team_id AND second column == user_name
    const targetTeam = (team_id || "").toString().trim().toLowerCase();
    const targetName = (user_name || "").toString().trim().toLowerCase();

    const rowIndex = rows.findIndex((r) => {
      const colA = (r[0] || "").toString().trim().toLowerCase();
      const colB = (r[1] || "").toString().trim().toLowerCase();
      return colA === targetTeam && colB === targetName;
    });

    if (rowIndex === -1) {
      return NextResponse.json({ error: "Team ID and name pair not found" }, { status: 404 });
    }

    // Sheets are 1-indexed
    const rowNumber = rowIndex + 1;

    // Base attendance column from .env (1-based). This is the column for "Attendance 1"
    const baseCol = parseInt(process.env.ATTENDANCE_COL, 10);
    if (isNaN(baseCol) || baseCol < 1) {
      return NextResponse.json({ error: "Invalid ATTENDANCE_COL" }, { status: 500 });
    }

    // attendanceIndex must be a positive integer (1 => attendance1)
    const idx = parseInt(attendanceIndex, 10);
    if (isNaN(idx) || idx < 1) {
      return NextResponse.json({ error: "Invalid attendanceIndex" }, { status: 400 });
    }

    const colNum = baseCol + (idx - 1);

    // optional safety: prevent writing beyond reasonable column (e.g. limit 100)
    if (colNum > 100) {
      return NextResponse.json({ error: "attendanceIndex results in out-of-range column" }, { status: 400 });
    }

    const colLetter = colNumberToLetter(colNum);
    const cellRange = `${colLetter}${rowNumber}`;

    // Skip if already marked TRUE
    const currentValue = rows[rowIndex][colNum - 1];
    if (currentValue === "TRUE" || currentValue === true) {
      return NextResponse.json({
        success: true,
        alreadyMarked: true,
        cell: cellRange,
        team_id,
        user_id,
        user_name,
        usedColumn: colNum,
      });
    }

    // Update cell to TRUE (mark attendance)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: cellRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[true]],
      },
    });

    return NextResponse.json({
      success: true,
      updated: { cell: cellRange, team_id, user_id, user_name },
      usedColumn: colNum,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}