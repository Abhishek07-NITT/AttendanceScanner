import { sheets } from "@googleapis/sheets";
import { GoogleAuth } from "google-auth-library";
import { NextResponse } from "next/server";

const SHEET_ID = process.env.SHEET_ID;
const RANGE = "A:N"; // Columns A through N: Team ID, Team Name, User ID, User Name, Attendance 1..10
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// In-memory cache singleton
let cachedRows = null;
let lastCacheFetchTime = 0;
let cachedSheets = null;

function getSheetsClient() {
  if (cachedSheets) return cachedSheets;

  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const cleanedKey = rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");

  const auth = new GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key: cleanedKey,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedSheets = sheets({ version: "v4", auth });
  return cachedSheets;
}

async function getSheetRows(sheets, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedRows && now - lastCacheFetchTime < CACHE_TTL_MS) {
    return cachedRows;
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });

  cachedRows = res.data.values || [];
  lastCacheFetchTime = now;
  return cachedRows;
}

// Convert 1-based column number to spreadsheet letter (5 -> E, 6 -> F)
function colNumberToLetter(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || "E";
}

// Locate participant in sheet rows:
// Col A = Team ID, Col B = Team Name, Col C = User ID, Col D = User Name
function findParticipantIndex(rows, targetUserId, targetTeamId) {
  return rows.findIndex((r) => {
    const colTeamId = (r[0] || "").toString().trim().toLowerCase();
    const colTeamName = (r[1] || "").toString().trim().toLowerCase();
    const colUserId = (r[2] || "").toString().trim().toLowerCase();

    // 1. Both User ID and Team ID/Name present
    if (targetUserId && targetTeamId) {
      const isUserMatch = colUserId === targetUserId;
      const isTeamMatch = colTeamId === targetTeamId || colTeamName === targetTeamId;
      if (isUserMatch && isTeamMatch) return true;
    }

    // 2. Exact User ID match (Column C: 3rd column)
    if (targetUserId && colUserId === targetUserId) {
      return true;
    }

    return false;
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const qrRaw = body.qr;
    const attendanceIndex = body.attendanceIndex ?? 1;

    if (!qrRaw || typeof qrRaw !== "string") {
      return NextResponse.json({ error: "Missing qr payload" }, { status: 400 });
    }

    // Parse payload: teamid:teamname:userid:username (or legacy comma format)
    let teamId = "";
    let teamName = "";
    let userId = "";
    let userName = "";

    if (qrRaw.includes(":")) {
      const parts = qrRaw.split(":").map((p) => p.trim());
      teamId = parts[0] || "";
      teamName = parts[1] || "";
      userId = parts[2] || "";
      userName = parts.slice(3).join(":").trim();
    } else {
      const parts = qrRaw.split(",").map((p) => p.trim());
      userId = parts[0] || "";
      userName = parts[1] || "";
      teamId = parts[2] || "";
    }

    const normUserId = (userId || "").toLowerCase().trim();
    const normTeamId = (teamId || "").toLowerCase().trim();
    const normTeamName = (teamName || "").toLowerCase().trim();
    const normUserName = (userName || "").toLowerCase().trim();

    if (!normUserId && !normUserName) {
      return NextResponse.json({ error: "Invalid QR format" }, { status: 400 });
    }

    const sheets = getSheetsClient();
    let rows = await getSheetRows(sheets);

    let rowIndex = findParticipantIndex(rows, normUserId, normTeamId);

    // Auto-refresh from Google once if newly added row isn't in cache yet
    if (rowIndex === -1) {
      rows = await getSheetRows(sheets, true);
      rowIndex = findParticipantIndex(rows, normUserId, normTeamId);
    }

    if (rowIndex === -1) {
      return NextResponse.json({ error: "Participant not found in sheet" }, { status: 404 });
    }

    // Target spreadsheet cell coordinates
    // Col A (1) = Team ID
    // Col B (2) = Team Name
    // Col C (3) = User ID
    // Col D (4) = User Name
    // Col E (5) = Attendance 1  <-- Column 5 unconditionally
    const rowNumber = rowIndex + 1; // 1-indexed in Google Sheets
    const baseCol = 5; // Attendance 1 is strictly Column E (Column 5)
    const idx = Math.max(1, parseInt(attendanceIndex, 10) || 1);
    const colNum = baseCol + (idx - 1); // For attendance 1: 5 + 0 = 5 (E). For attendance 2: 5 + 1 = 6 (F).
    const colLetter = colNumberToLetter(colNum);
    const cellRange = `${colLetter}${rowNumber}`;

    // Check if attendance is already recorded
    const currentRow = rows[rowIndex];
    const currentValue = currentRow ? currentRow[colNum - 1] : undefined;
    const isAlreadyMarked =
      currentValue === true ||
      String(currentValue).toUpperCase() === "TRUE";

    // Column A = Team ID, Column B = Team Name, Column C = User ID, Column D = User Name
    const sheetTeamId = rows[rowIndex][0] || teamId;
    const sheetTeamName = rows[rowIndex][1] || teamName;
    const sheetUserId = rows[rowIndex][2] || userId;
    const sheetUserName = rows[rowIndex][3] || userName;

    const participantData = {
      team_id: sheetTeamName ? `${sheetTeamId} (${sheetTeamName})` : sheetTeamId,
      user_id: sheetUserId,
      user_name: sheetUserName,
    };

    if (isAlreadyMarked) {
      return NextResponse.json({
        success: true,
        alreadyMarked: true,
        cell: cellRange,
        updated: participantData,
      });
    }

    // Update Google Sheet cell to TRUE
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: cellRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[true]],
      },
    });

    // Update in-memory row cache so repeated scans resolve in ~5ms
    if (rows && rows[rowIndex]) {
      rows[rowIndex][colNum - 1] = "TRUE";
    }

    return NextResponse.json({
      success: true,
      alreadyMarked: false,
      cell: cellRange,
      updated: participantData,
    });
  } catch (err) {
    console.error("Attendance submission error:", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}