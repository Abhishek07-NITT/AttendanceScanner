import fs from "fs";
import path from "path";
import readline from "readline";
import QRCode from "qrcode";

/**
 * Parses CSV file supporting: team_id, team_name, user_id, user_name
 */
async function parseCsv(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = null;
  const records = [];

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    // Split by comma respecting quotes
    const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));

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

    if (userId && userName) {
      records.push({
        teamId: teamId || "T01",
        teamName: teamName || teamId || "Team",
        userId,
        userName,
      });
    }
  }

  return records;
}

/**
 * Generates an A4 Printable PDF containing badges (12 per page in a 3x4 grid).
 * Format: teamid:teamname:userid:username (No secret / HMAC)
 */
function buildBadgesPdf(records) {
  // A4 dimensions in PDF points (72 pt per inch)
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  const cols = 3;
  const rows = 4;
  const badgesPerPage = cols * rows;

  const marginX = 26;
  const marginY = 30;
  const gapX = 14;
  const gapY = 14;

  const badgeWidth = (pageWidth - marginX * 2 - gapX * (cols - 1)) / cols; // ~165 pt
  const badgeHeight = (pageHeight - marginY * 2 - gapY * (rows - 1)) / rows; // ~186 pt
  const qrBoxSize = 104; // QR code dimension in points

  const totalPages = Math.ceil(records.length / badgesPerPage) || 1;
  const pageContents = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageRecords = records.slice(
      pageIdx * badgesPerPage,
      (pageIdx + 1) * badgesPerPage
    );

    let ops = "";

    pageRecords.forEach((record, idx) => {
      const colIdx = idx % cols;
      const rowIdx = Math.floor(idx / cols);

      // Top-left corner of badge
      const x = marginX + colIdx * (badgeWidth + gapX);
      const topY = marginY + rowIdx * (badgeHeight + gapY);

      // Convert to PDF bottom-left coordinate
      const y = pageHeight - topY - badgeHeight;

      // 1. Draw outer badge border (#d4d4d4)
      ops += `0.82 0.82 0.82 RG 0.8 w\n`;
      ops += `${x.toFixed(2)} ${y.toFixed(2)} ${badgeWidth.toFixed(2)} ${badgeHeight.toFixed(2)} re S\n`;

      // 2. Header dark band (#0a0a0a)
      const headerH = 22;
      const headerY = y + badgeHeight - headerH;
      ops += `0.04 0.04 0.04 rg\n`;
      ops += `${x.toFixed(2)} ${headerY.toFixed(2)} ${badgeWidth.toFixed(2)} ${headerH.toFixed(2)} re f\n`;

      // Header title: TRANSFINITTE '26
      ops += `BT\n/F2 8.5 Tf\n1 1 1 rg\n`;
      const title = "TRANSFINITTE '26";
      const titleW = title.length * 4.9;
      const titleX = x + (badgeWidth - titleW) / 2;
      ops += `${titleX.toFixed(2)} ${(headerY + 7).toFixed(2)} Td (${title}) Tj\nET\n`;

      // 3. New Format: teamid:teamname:userid:username (No secret)
      const payload = `${record.teamId}:${record.teamName}:${record.userId}:${record.userName}`;

      const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
      const modSize = qr.modules.size;
      const modData = qr.modules.data;
      const cellSize = qrBoxSize / modSize;

      const qrX = x + (badgeWidth - qrBoxSize) / 2;
      const qrY = y + 44;

      ops += `0 0 0 rg\n`; // Black QR modules
      for (let r = 0; r < modSize; r++) {
        for (let c = 0; c < modSize; c++) {
          if (modData[r * modSize + c]) {
            const cellX = qrX + c * cellSize;
            const cellY = qrY + (modSize - 1 - r) * cellSize;
            ops += `${cellX.toFixed(2)} ${cellY.toFixed(2)} ${(cellSize + 0.05).toFixed(2)} ${(cellSize + 0.05).toFixed(2)} re f\n`;
          }
        }
      }

      // 4. Draw Participant Name (Bold, 10pt)
      const cleanName = record.userName.replace(/[()\\]/g, "").slice(0, 24);
      ops += `BT\n/F2 10 Tf\n0.05 0.05 0.05 rg\n`;
      const nameW = cleanName.length * 5.5;
      const nameX = x + Math.max(4, (badgeWidth - nameW) / 2);
      ops += `${nameX.toFixed(2)} ${(y + 28).toFixed(2)} Td (${cleanName}) Tj\nET\n`;

      // 5. Draw Team & User ID (Regular, 7.5pt)
      const cleanTeam = (record.teamName || record.teamId).replace(/[()\\]/g, "").slice(0, 16);
      const cleanId = record.userId.replace(/[()\\]/g, "").slice(0, 12);
      const meta = `${cleanTeam} | ${cleanId}`;
      ops += `BT\n/F1 7.5 Tf\n0.35 0.35 0.35 rg\n`;
      const metaW = meta.length * 3.8;
      const metaX = x + Math.max(4, (badgeWidth - metaW) / 2);
      ops += `${metaX.toFixed(2)} ${(y + 13).toFixed(2)} Td (${meta}) Tj\nET\n`;
    });

    pageContents.push(ops);
  }

  // Construct PDF objects
  const objects = [];
  function addObj(str) {
    objects.push(str);
    return objects.length;
  }

  // 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`);

  // 2: Pages container
  const pagesRootIdx = addObj(``);

  // 3: Font Helvetica (Regular)
  const font1Idx = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

  // 4: Font Helvetica-Bold
  const font2Idx = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);

  const pageIds = [];

  for (let i = 0; i < pageContents.length; i++) {
    const content = pageContents[i];
    const len = Buffer.byteLength(content, "utf-8");

    // Content Stream Object
    const contentObjIdx = addObj(`<< /Length ${len} >>\nstream\n${content}\nendstream`);

    // Page Object
    const pageObjIdx = addObj(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${font1Idx} 0 R /F2 ${font2Idx} 0 R >> >> /Contents ${contentObjIdx} 0 R >>`
    );

    pageIds.push(`${pageObjIdx} 0 R`);
  }

  // Patch Pages Root container
  objects[pagesRootIdx - 1] = `<< /Type /Pages /Kids [${pageIds.join(" ")}] /Count ${pageIds.length} >>`;

  // Output serialization
  let output = "%PDF-1.4\n";
  const xrefOffsets = [];

  for (let i = 0; i < objects.length; i++) {
    xrefOffsets.push(output.length);
    output += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const startXref = output.length;
  output += `xref\n0 ${objects.length + 1}\n`;
  output += `0000000000 65535 f \n`;
  for (const offset of xrefOffsets) {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  output += `startxref\n${startXref}\n%%EOF\n`;

  return Buffer.from(output, "binary");
}

/**
 * Main execution routine.
 */
async function main() {
  const args = process.argv.slice(2);
  const inputCsv =
    args[0] || path.join("qr_generator", "input", "participants_sample.csv");
  const outputPdf =
    args[1] || path.join("qr_generator", "output", "attendance_badges.pdf");

  if (!fs.existsSync(inputCsv)) {
    console.error(`❌ Input CSV not found: ${inputCsv}`);
    console.log(
      `\nUsage:\n  node qr_generator/generate_pdf.js [path/to/participants.csv] [path/to/output.pdf]\n`
    );
    process.exit(1);
  }

  console.log(`\n==============================================`);
  console.log(`📄 TRANSFINITTE QR CODE & PDF BADGE GENERATOR`);
  console.log(`==============================================`);
  console.log(`📥 Reading CSV : ${inputCsv}`);

  const participants = await parseCsv(inputCsv);
  if (participants.length === 0) {
    console.error(`⚠️ No valid participants found in CSV.`);
    process.exit(1);
  }

  console.log(`👥 Found       : ${participants.length} participant(s)`);
  console.log(`📋 Format      : teamid:teamname:userid:username (No secret)`);
  console.log(`🖨️ Generating  : A4 printable badge sheet (12 badges / page)`);

  const pdfBuffer = buildBadgesPdf(participants);

  const outDir = path.dirname(outputPdf);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPdf, pdfBuffer);

  const pageCount = Math.ceil(participants.length / 12);
  console.log(`\n✅ Generated   : ${outputPdf}`);
  console.log(`📊 Total Pages : ${pageCount} page(s)`);
  console.log(`==============================================\n`);
}

main().catch(console.error);
