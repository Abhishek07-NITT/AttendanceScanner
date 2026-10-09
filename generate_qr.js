import fs from "fs";
import readline from "readline";
import QRCode from "qrcode";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const SECRET_STRING = process.env.SECRET_STRING || "transfinitte-26-secret-key";
const inputFile = "qr.csv";
const outputDir = "qrs";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

if (!fs.existsSync(inputFile)) {
  console.log(`ℹ️ Input file ${inputFile} not found. Ready for single QR generation.`);
  process.exit(0);
}

let successCount = 0;
let totalCount = 0;

const rl = readline.createInterface({
  input: fs.createReadStream(inputFile),
  crlfDelay: Infinity,
});

let headers = null;

rl.on("line", async (line) => {
  if (!line.trim()) return;

  const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  if (!headers) {
    headers = cols;
    return;
  }

  totalCount++;
  const row = {};
  headers.forEach((h, i) => {
    row[h] = cols[i] || "";
  });

  const userId = (row.user_id || cols[1] || "").toString().trim();
  const userName = (row.user_name || cols[2] || "").toString().trim();
  const teamId = (row.team_id || cols[0] || "").toString().trim();

  if (!userId || !userName) return;

  const safeUserName = userName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  const fileName = `${teamId}_${safeUserName}.png`;
  const finalPath = `${outputDir}/${fileName}`;

  const hmacSecret = crypto
    .createHmac("sha256", SECRET_STRING)
    .update(`${userId}:${teamId}:${userName}`)
    .digest("hex")
    .slice(0, 12);

  const qrContent = `${userId},${userName},${teamId},${hmacSecret}`;

  try {
    await QRCode.toFile(finalPath, qrContent, {
      margin: 2,
      scale: 10,
      color: { dark: "#000000", light: "#ffffff" },
    });
    successCount++;
    console.log(`✅ QR saved: ${finalPath}`);
  } catch (err) {
    console.error(`❌ Error generating QR for ${userName}:`, err);
  }
});

rl.on("close", () => {
  console.log(`\n🎉 CSV batch complete: ${successCount}/${totalCount} QR codes generated.`);
});
