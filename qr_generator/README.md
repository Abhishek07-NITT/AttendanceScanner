# Transfinitte QR Code PNG Generator

A fast batch QR code generator for Transfinitte event participants. Reads participant data from a CSV file and saves individual high-resolution PNG images named by each participant's `user_id` inside `qr_generator/output/`.

---

## ⚡ Quick Start

### 1. Prepare your CSV
Save your participant spreadsheet as a `.csv` inside `qr_generator/input/` (e.g., `qr_generator/input/participants.csv`).

### 2. Generate the QR Code Images
Run the generator using npm:
```bash
npm run generate:qr
```

Or run directly with Node:
```bash
node qr_generator/generate_qr.js
```

You can also specify custom input/output paths:
```bash
node qr_generator/generate_qr.js path/to/participants.csv path/to/output_folder/
```

The resulting PNG images will be saved in `qr_generator/output/<user_id>.png` (e.g. `101.png`, `102.png`, etc.).

---

## 📋 CSV Format & Requirements

The CSV parser supports standard comma-delimited columns with flexible naming:

| Column | Accepted Header Names | Description | Example |
| :--- | :--- | :--- | :--- |
| **Team ID** | `team_id`, `team` | Unique team code | `T101` |
| **Team Name** | `team_name`, `team` | Name of the team | `TeamAlpha` |
| **User ID** | `user_id`, `id`, `rollno` | Participant ID or College Roll Number | `101` |
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

Each generated image encodes participant data in the standard format:
```text
teamid:teamname:userid:username
```

**Example:**
```text
T101:TeamAlpha:101:John Doe
```

---

## 📁 Output Structure

```
qr_generator/
├── input/
│   └── participants_sample.csv
├── output/
│   ├── 101.png
│   ├── 102.png
│   ├── 103.png
│   ├── 104.png
│   ├── 105.png
│   └── 106.png
├── generate_qr.js
└── README.md
```
