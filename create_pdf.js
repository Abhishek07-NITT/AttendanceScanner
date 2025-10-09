import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

// ...existing code...

// Simple CLI arg parser
function getArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx < process.argv.length - 1) return process.argv[idx + 1];
  return fallback;
}

function mmToPt(mm) {
  return (mm * 72) / 25.4;
}

const inputDir = getArg("--input", "qrs");
const outFile = getArg("--output", "qrs_sheets.pdf");
const cols = parseInt(getArg("--cols", "3"), 10);
const rows = parseInt(getArg("--rows", "8"), 10);
const marginMM = parseFloat(getArg("--marginMM", "10"));
const gapMM = parseFloat(getArg("--gapMM", "5"));
const labelHeightMM = parseFloat(getArg("--labelHeightMM", "10"));

const a4WidthPt = mmToPt(210);
const a4HeightPt = mmToPt(297);
const margin = mmToPt(marginMM);
const gap = mmToPt(gapMM);
const labelHeight = mmToPt(labelHeightMM);

if (!fs.existsSync(inputDir)) {
  console.error("Input directory not found:", inputDir);
  process.exit(1);
}

const files = fs.readdirSync(inputDir)
  .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
  .map(f => path.join(inputDir, f))
  .sort();

if (files.length === 0) {
  console.error("No image files found in", inputDir);
  process.exit(1);
}

// compute cell size (we reserve labelHeight under each QR)
const usableWidth = a4WidthPt - margin * 2 - gap * (cols - 1);
const cellWidth = usableWidth / cols;

const usableHeight = a4HeightPt - margin * 2 - gap * (rows - 1);
const cellHeight = (usableHeight / rows) - labelHeight; // QR area height
const qrSize = Math.min(cellWidth, cellHeight); // square QR size

const doc = new PDFDocument({
  size: [a4WidthPt, a4HeightPt],
  margins: { top: 0, left: 0, bottom: 0, right: 0 },
});

const outStream = fs.createWriteStream(outFile);
doc.pipe(outStream);

let placed = 0;
const perPage = cols * rows;

for (let i = 0; i < files.length; i++) {
  const pageIndex = Math.floor(i / perPage);
  const indexOnPage = i % perPage;
  const row = Math.floor(indexOnPage / cols);
  const col = indexOnPage % cols;

  if (indexOnPage === 0 && i !== 0) doc.addPage();

  const x = margin + col * (cellWidth + gap) + (cellWidth - qrSize) / 2;
  const y = margin + row * (cellHeight + labelHeight + gap) + (cellHeight - qrSize) / 2;

  // draw image (scaled to qrSize)
  try {
    doc.image(files[i], x, y, { width: qrSize, height: qrSize });
  } catch (err) {
    console.warn("Failed to draw image:", files[i], err.message);
    continue;
  }

  // draw filename (or parsed label) under the QR
  const base = path.basename(files[i], path.extname(files[i]));
  // If filenames follow team_user pattern, try to prettify
  const pretty = base.replace(/_/g, " ");
  const textX = margin + col * (cellWidth + gap);
  const textY = y + qrSize + 4;
  const textWidth = cellWidth;

  doc.fontSize(9).fillColor("black");
  doc.text(pretty, textX, textY, { width: textWidth, align: "center" });

  placed++;
}

// finalize
doc.end();

outStream.on("finish", () => {
  console.log(`Created ${outFile} with ${placed} QR(s) across ${Math.ceil(placed / perPage)} page(s).`);
});