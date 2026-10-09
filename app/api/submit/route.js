import { google } from "googleapis";
import { NextResponse } from "next/server";
import crypto from "crypto";

const SHEET_ID = process.env.SHEET_ID;
const RANGE = "A:M"; // Columns A through M (Team, UserID, Name, Attendance 1..10)

// 10-minute in-memory cache for sheet rows (600,000 ms)
const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedRows = null;
let lastCacheFetchTime = 0;

async function getSheetRows(sheets, spreadsheetId, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedRows && now - lastCacheFetchTime < CACHE_TTL_MS) {
    return cachedRows;
  }

  const sheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: RANGE,
  });

  cachedRows = sheetRes.data.values || [];
  lastCacheFetchTime = now;
  return cachedRows;
}

// Reusable singleton auth and sheets client to avoid re-authenticating every scan
let cachedSheets = null;

function getSheetsClient() {
  if (cachedSheets) return cachedSheets;

  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const cleanedKey = rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key: cleanedKey,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedSheets = google.sheets({ version: "v4", auth });
  return cachedSheets;
}

// Convert column number (1-based: 1=A, 4=D, etc.) to letter
function colNumberToLetter(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || "D";
}

function findParticipantIndex(rows, targetTeam, targetUserId, targetName) {
  return rows.findIndex((r) => {
    const colA = (r[0] || "").toString().trim().toLowerCase();
    const colB = (r[1] || "").toString().trim().toLowerCase();
    const colC = (r[2] || "").toString().trim().toLowerCase();

    // Check Team ID + (User ID or Name)
    if (colA === targetTeam && (colB === targetUserId || colC === targetName)) {
      return true;
    }
    if (colA === targetTeam && colB === targetName) {
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

    // 1. Fast HMAC Verification (< 1ms)
    const parts = qrRaw.split(",").map((p) => p.trim());
    if (parts.length < 4) {
      return NextResponse.json({ error: "Invalid QR format" }, { status: 400 });
    }

    const secret = parts[parts.length - 1];
    const team_id = parts[parts.length - 2];
    const user_id = parts[0];
    const user_name = parts.slice(1, parts.length - 2).join(",").trim();

    const secretKey = process.env.SECRET_STRING || "transfinitte-26-secret-key";
    const normalizedUserId = (user_id || "").toString().trim();
    const normalizedTeamId = (team_id || "").toString().trim();
    const normalizedUserName = (user_name || "").toString().trim();

    const expectedFullHmac = crypto
      .createHmac("sha256", secretKey)
      .update(`${normalizedUserId}:${normalizedTeamId}:${normalizedUserName}`)
      .digest("hex");

    const expectedShortHmac = expectedFullHmac.slice(0, 12);
    const secretLower = secret.toLowerCase();

    const isValid =
      secretLower === expectedShortHmac.toLowerCase() ||
      (secret.length >= 8 && expectedFullHmac.toLowerCase().startsWith(secretLower)) ||
      (process.env.NODE_ENV !== "production" && secret === secretKey);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid QR signature" }, { status: 403 });
    }

    // 2. Direct High-Speed Google Sheets API
    const sheets = getSheetsClient();
    const targetSheetId = process.env.SHEET_ID || "1ZlnHaUdnEfEvu1TkG77yzlEmLTnMScaphN2R0ww1O2E";

    // Fast memory cache lookup (10 min TTL)
    let rows = await getSheetRows(sheets, targetSheetId);
    if (!rows || rows.length === 0) {
      rows = await getSheetRows(sheets, targetSheetId, true);
    }

    const targetTeam = normalizedTeamId.toLowerCase();
    const targetUserId = normalizedUserId.toLowerCase();
    const targetName = normalizedUserName.toLowerCase();

    let rowIndex = findParticipantIndex(rows, targetTeam, targetUserId, targetName);

    // If not found in cache, auto-refresh once from Google in case this row was newly added
    if (rowIndex === -1) {
      rows = await getSheetRows(sheets, targetSheetId, true);
      rowIndex = findParticipantIndex(rows, targetTeam, targetUserId, targetName);
    }

    if (rowIndex === -1) {
      return NextResponse.json({ error: "Participant not found in sheet" }, { status: 404 });
    }

    const rowNumber = rowIndex + 1; // 1-indexed row in Google Sheets
    const baseCol = parseInt(process.env.ATTENDANCE_COL || "4", 10); // Col D = 4
    const colNum = baseCol + (parseInt(attendanceIndex, 10) - 1);
    const colLetter = colNumberToLetter(colNum);
    const cellRange = `${colLetter}${rowNumber}`;

    // Check if already marked
    const currentRow = rows[rowIndex];
    const currentValue = currentRow ? currentRow[colNum - 1] : undefined;
    const isAlreadyMarked =
      currentValue === true ||
      currentValue === "TRUE" ||
      String(currentValue).toUpperCase() === "TRUE";

    if (isAlreadyMarked) {
      return NextResponse.json({
        success: true,
        alreadyMarked: true,
        cell: cellRange,
        updated: {
          team_id,
          user_id,
          user_name: rows[rowIndex][2] || user_name,
        },
        usedColumn: colNum,
      });
    }

    // Fast direct write to cell
    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSheetId,
      range: cellRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[true]],
      },
    });

    // Update in-memory cache row in place so immediate rescans are recognized instantly
    if (rows && rows[rowIndex]) {
      rows[rowIndex][colNum - 1] = "TRUE";
    }

    return NextResponse.json({
      success: true,
      alreadyMarked: false,
      cell: cellRange,
      updated: {
        team_id,
        user_id,
        user_name: rows[rowIndex][2] || user_name,
      },
      usedColumn: colNum,
    });
  } catch (err) {
    console.error("Google Sheets API error:", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}