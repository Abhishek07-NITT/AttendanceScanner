const fs = require("fs");
const path = require("path");
const readline = require("readline");
const QRCode = require("qrcode");

/**
 * Parses CSV file supporting columns: team_id, team_name, user_id, user_name
 */
async function parseCsv(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = null;
  const records = [];

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    // Split by comma respecting quoted fields
    const cols = line
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((c) => c.trim().replace(/^["']|["']$/g, ""));

    if (!headers) {
      headers = cols.map((h) => h.toLowerCase().replace(/[\s_-]+/g, ""));
      continue;
    }

    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] || "";
    });

    const teamId = (
      row.teamid ||
      row.team ||
      cols[0] ||
      ""
    ).toString().trim();

    const teamName = (
      row.teamname ||
      row.team ||
      cols[1] ||
      teamId
    ).toString().trim();

    const userId = (
      row.userid ||
      row.id ||
      row.rollno ||
      cols[2] ||
      ""
    ).toString().trim();

    const userName = (
      row.username ||
      row.name ||
      row.participantname ||
      cols[3] ||
      ""
    ).toString().trim();

    if (userId) {
      records.push({
        teamId: teamId || "T01",
        teamName: teamName || teamId || "Team",
        userId,
        userName: userName || userId,
      });
    }
  }

  return records;
}

/**
 * Sanitizes user ID so it is safe to use as a filename on any OS
 */
function sanitizeFilename(userId) {
  return userId.replace(/[/\\?%*:|"<>]/g, "_").trim();
}

async function main() {
  const inputArg = process.argv[2];
  const outputDirArg = process.argv[3];

  const defaultInputDir = path.join(__dirname, "input");
  const outputDir = outputDirArg
    ? path.resolve(outputDirArg)
    : path.join(__dirname, "output");

  let inputPath = inputArg ? path.resolve(inputArg) : null;

  if (!inputPath) {
    if (fs.existsSync(defaultInputDir)) {
      const csvFiles = fs
        .readdirSync(defaultInputDir)
        .filter((f) => f.endsWith(".csv"));

      if (csvFiles.length > 0) {
        inputPath = path.join(defaultInputDir, csvFiles[0]);
      }
    }
  }

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error("❌ Error: No CSV file found.");
    console.error("Place a CSV in qr_generator/input/ or pass the path:");
    console.error("  node qr_generator/generate_qr.js path/to/participants.csv");
    process.exit(1);
  }

  // Clear existing files in output directory so stale QR codes are removed
  if (fs.existsSync(outputDir)) {
    const existingFiles = fs.readdirSync(outputDir);
    for (const file of existingFiles) {
      const fullPath = path.join(outputDir, file);
      if (fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
      }
    }
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log("\n==============================================");
  console.log("📷 TRANSFINITTE QR CODE PNG GENERATOR");
  console.log("==============================================");
  console.log(`📥 Reading CSV  : ${path.relative(process.cwd(), inputPath)}`);
  console.log(`📁 Output Folder: ${path.relative(process.cwd(), outputDir)}/`);

  const records = await parseCsv(inputPath);
  console.log(`👥 Found        : ${records.length} participant(s)`);
  console.log(`📋 Format       : teamid:teamname:userid:username (No secret)`);
  console.log("----------------------------------------------");

  if (records.length === 0) {
    console.warn("⚠️ Warning: No valid participants found in CSV.");
    process.exit(0);
  }

  let count = 0;
  for (const record of records) {
    // Standard payload: teamid:teamname:userid:username
    const payload = `${record.teamId}:${record.teamName}:${record.userId}:${record.userName}`;
    const safeName = sanitizeFilename(record.userId);
    const fileName = `${safeName}.png`;
    const destPath = path.join(outputDir, fileName);

    await QRCode.toFile(destPath, payload, {
      type: "png",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    count++;
    console.log(
      `  [✓] ${fileName.padEnd(16)} -> ${payload}`
    );
  }

  console.log("----------------------------------------------");
  console.log(`🎉 Successfully generated ${count} QR code image(s)!`);
  console.log(`📂 Location: ${path.relative(process.cwd(), outputDir)}/`);
  console.log("==============================================\n");
}

main().catch((err) => {
  console.error("❌ Error generating QR codes:", err);
  process.exit(1);
});

