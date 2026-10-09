import dotenv from "dotenv";
import crypto from "crypto";
import QRCode from "qrcode";

dotenv.config();

const SECRET_STRING = process.env.SECRET_STRING || "transfinitte-26-secret-key";

// Usage: node make_user_qr.js <userId> <userName> <teamId> [outputImagePath]
const args = process.argv.slice(2);

const userId = args[0] || "102";
const userName = args[1] || "Alice Smith";
const teamId = args[2] || "TeamBeta";
const outputFile = args[3] || `public/qr_${userId}.png`;

async function generateSingleQR() {
  const normalizedUserId = userId.toString().trim();
  const normalizedUserName = userName.toString().trim();
  const normalizedTeamId = teamId.toString().trim();

  // 1. Calculate HMAC
  const hmac = crypto
    .createHmac("sha256", SECRET_STRING)
    .update(`${normalizedUserId}:${normalizedTeamId}:${normalizedUserName}`)
    .digest("hex")
    .slice(0, 12);

  const qrPayload = `${normalizedUserId},${normalizedUserName},${normalizedTeamId},${hmac}`;

  console.log("\n========================================");
  console.log("🎟️ NEW PARTICIPANT QR GENERATED");
  console.log("========================================");
  console.log(`👤 User ID : ${normalizedUserId}`);
  console.log(`📛 Name    : ${normalizedUserName}`);
  console.log(`👥 Team    : ${normalizedTeamId}`);
  console.log(`🔑 HMAC    : ${hmac}`);
  console.log(`📦 Payload : ${qrPayload}`);
  console.log("========================================");

  // 2. Generate clean high-resolution QR PNG (No native binary dependencies needed)
  await QRCode.toFile(outputFile, qrPayload, {
    margin: 2,
    scale: 10,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  console.log(`✅ Saved QR badge image to: ${outputFile}\n`);
}

generateSingleQR().catch(console.error);

