import fs from "fs";
import csv from "csv-parser";
import QRCode from "qrcode";
import dotenv from "dotenv";
import { createCanvas, loadImage } from "canvas";
import crypto from "crypto";

dotenv.config(); // Load .env file

const SECRET_STRING = process.env.SECRET_STRING || "transfinitte-26-secret-key";

const inputFile = "qr.csv";
const outputDir = "qrs";

// Ensure qrs folder exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

let successCount = 0;
let totalCount = 0;

fs.createReadStream(inputFile)
  .pipe(csv())
  .on("data", async (row) => {
    totalCount++;
    try {
      const { user_id, user_name, team_id } = row;

      const normalizedUserId = (user_id || "").toString().trim();
      const normalizedTeamId = (team_id || "").toString().trim();
      const normalizedUserName = (user_name || "").toString().trim();

      // Clean up for filenames
      const safeUserName = normalizedUserName
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "");
      const fileName = `${normalizedTeamId}_${safeUserName}.png`;

      // Generate per-user short HMAC: hmac(userid:teamid:username)
      const hmacSecret = crypto
        .createHmac("sha256", SECRET_STRING)
        .update(`${normalizedUserId}:${normalizedTeamId}:${normalizedUserName}`)
        .digest("hex")
        .slice(0, 12);

      const qrContent = `${normalizedUserId},${normalizedUserName},${normalizedTeamId},${hmacSecret}`;
      const qrTempPath = `${outputDir}/_temp_${fileName}`;
      const finalPath = `${outputDir}/${fileName}`;

      // Step 1: Generate QR temporarily
      await QRCode.toFile(qrTempPath, qrContent, {
        margin: 1,
        scale: 10,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      // Step 2: Load the QR into a canvas and add text below
      const qrImage = await loadImage(qrTempPath);
      const qrWidth = qrImage.width;
      const textAreaHeight = 80;
      const canvas = createCanvas(qrWidth, qrWidth + textAreaHeight);
      const ctx = canvas.getContext("2d");

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw QR
      ctx.drawImage(qrImage, 0, 0, qrWidth, qrWidth);

      // Text styling
      ctx.fillStyle = "#000000";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";

      // Step 3: Draw team_id and user_name
      ctx.fillText(team_id, qrWidth / 2, qrWidth + 30);
      ctx.font = "20px Arial";
      ctx.fillText(user_name, qrWidth / 2, qrWidth + 60);

      // Step 4: Save final image
      const buffer = canvas.toBuffer("image/png");
      fs.writeFileSync(finalPath, buffer);

      // Cleanup temp file
      fs.unlinkSync(qrTempPath);

      successCount++;
      console.log(`✅ QR saved: ${finalPath}`);
    } catch (err) {
      console.error("❌ Error generating QR:", err);
    }
  })
  .on("end", () => {
    console.log("\n🎉 QR generation completed!");
    console.log(`✅ Successfully generated: ${successCount}/${totalCount} QR codes`);
  })
  .on("error", (err) => {
    console.error("❌ Error reading CSV:", err);
  });
