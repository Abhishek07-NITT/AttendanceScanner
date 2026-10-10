# Transfinitte QR Badge & Printable PDF Generator

A zero-dependency vector PDF badge generator for Transfinitte event participants. Reads participant data from a CSV and generates print-ready A4 badge sheets formatted in a clean 3×4 grid (12 badges per sheet).

---

## ⚡ Quick Start

### 1. Prepare your CSV
Save your participant spreadsheet as a `.csv` inside `qr_generator/input/` (e.g., `qr_generator/input/participants.csv`).

### 2. Generate the PDF
Run the generator using npm:
```bash
npm run generate:pdf
```

Or specify custom input/output paths directly:
```bash
node qr_generator/generate_pdf.js qr_generator/input/participants.csv qr_generator/output/badges.pdf
```

The resulting file will be written to `qr_generator/output/badges.pdf`, ready to print on standard A4 paper.

---

## 📋 CSV Format & Requirements

The CSV parser supports standard comma-delimited columns with flexible naming:

| Column | Accepted Header Names | Description | Example |
| :--- | :--- | :--- | :--- |
| **Team ID** | `team_id`, `team` | Unique team code | `T101` |
| **Team Name** | `team_name`, `team` | Name of the team | `TeamAlpha` |
| **User ID** | `user_id`, `id`, `rollNo` | Participant ID or College Roll Number | `101` |
| **User Name** | `user_name`, `name` | Full name of the participant | `John Doe` |

### Sample CSV (`participants_sample.csv`):
```csv
team_id,team_name,user_id,user_name
T101,TeamAlpha,101,John Doe
T102,TeamBeta,102,Alice Smith
T103,TeamDelta,103,Bob Marley
T104,TeamCyber,104,Sarah Connor
```

---

## 🏷️ QR Code Payload Format

Each badge encodes the participant information in the colon-separated format:
```text
teamid:teamname:userid:username
```

**Example:**
```text
T101:TeamAlpha:101:John Doe
```

---

## 🖨️ Badge Sheet Layout (A4)

- **Grid**: 3 Columns × 4 Rows = **12 ID Badges per A4 page**.
- **Badge Anatomy**:
  - Dark header band branded with **TRANSFINITTE '26**.
  - High-contrast centered QR code.
  - Bold participant name.
  - Subtitle with `Team Name | User ID`.
  - Outer border guides for easy paper cutting.
- **Zero Native Dependencies**: Pure JavaScript vector rendering (no C++ compilers, `canvas`, or `node-gyp` required).
