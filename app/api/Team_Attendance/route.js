// import QRCode from "qrcode";
// import { google } from "googleapis";

// const SHEET_ID = "15B0voPZUZDSvtBuCFnGlEGxJ6g3F8fMn9Ib1QS1JNec";
// const RANGE = "A1:Z"; // Adjust range as needed
// const mySet = new Set();

// async function getAuth() {
//   const auth = new google.auth.GoogleAuth({
//     credentials: {
//       type: "service_account",
//       project_id: process.env.GOOGLE_PROJECT_ID,
//       private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//       client_email: process.env.GOOGLE_CLIENT_EMAIL,
//     },
//     scopes: ["https://www.googleapis.com/auth/spreadsheets"],
//   });

//   return auth;
// }

// export async function POST(request) {
//   try {
//     const auth = await getAuth();
//     const sheets = google.sheets({ version: "v4", auth });

//     // Get sheet data
//     const res = await sheets.spreadsheets.values.get({
//       spreadsheetId: SHEET_ID,
//       range: RANGE,
//     });

//     const rows = res.data.values || [];
//     if (rows.length < 2) {
//       return new Response(JSON.stringify({ error: "No user data found" }), {
//         status: 404,
//       });
//     }

//     // First row is header
//     const headers = rows[0];
//     const dataRows = rows.slice(1);

//     const TeamNameCol=headers.indexOf("Team name");
//     if(TeamNameCol===-1){
//       return new Response(JSON.stringify({ error: "No Team Name column found" }), {
//         status: 404,
//       });
//     }
//     for(let i=0;i<TeamNameCol;i++){
//       mySet.add(dataRows[i][TeamNameCol]);
//     }

//     for (const val of mySet) {
        
//         // Write back updated data
//     await sheets.spreadsheets.values.update({
//       spreadsheetId: SHEET_ID,
//       range: `H2:${String.fromCharCode(65 + headers.length - 1)}${rows.length}`,
//       valueInputOption: "USER_ENTERED",
//       requestBody: {
//         values: dataRows,
//       },
//     });

  
// }

 
    

   

//     return new Response(JSON.stringify({ message:" Team Attendance Marked"}), {
//       status: 200,
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     console.error("Error generating QR:", error);
//     return new Response(JSON.stringify({ error: "Failed to mark Team Attendance" }), {
//       status: 500,
//     });
//   }
// }