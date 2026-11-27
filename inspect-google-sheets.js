const { google } = require("googleapis");
const path = require("path");
require("dotenv").config();

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  const studentHeaders = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Students!1:1"
  });

  const studentRows = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Students!A2:A"
  });

  const courseData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Courses!A1:Z20"
  });

  console.log("\nSTUDENT HEADERS:");
  console.log(studentHeaders.data.values?.[0] || []);

  console.log("\nSTUDENT RECORD COUNT:");
  console.log(Math.max(0, (studentRows.data.values || []).length));

  console.log("\nCOURSES SHEET:");
  console.log(JSON.stringify(courseData.data.values || [], null, 2));
}

main().catch(err => {
  console.error("Inspection failed:", err.message);
  process.exitCode = 1;
});
