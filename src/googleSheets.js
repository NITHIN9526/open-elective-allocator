
require("dotenv").config();

const { google } = require("googleapis");
const path = require("path");

let sheetsClient;

function getGoogleSheets() {
  if (sheetsClient) return sheetsClient;

  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!spreadsheetId || !keyFile) {
    throw new Error("Google Sheets environment configuration is missing.");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(keyFile),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

function getSpreadsheetId() {
  return process.env.GOOGLE_SHEETS_ID;
}

async function updateStudentProfile(profile) {
  const sheets = getGoogleSheets();
  const spreadsheetId = getSpreadsheetId();
  const tabName = "Students";

  const requiredHeaders = [
    "PRN", "Mobile", "Email", "CGPA", "Current_Semester",
    "Academic_Year", "Profile_Status", "Profile_Updated_At"
  ];

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!1:1`
  });

  const headers = headerResponse.data.values?.[0] || [];

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Google Sheet is missing the required column: ${header}`);
    }
  }

  const columnLetter = number => {
    let result = "";
    while (number > 0) {
      const remainder = (number - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      number = Math.floor((number - 1) / 26);
    }
    return result;
  };

  const prnColumn = columnLetter(headers.indexOf("PRN") + 1);

  const prnResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!${prnColumn}2:${prnColumn}`
  });

  const targetPrn = String(profile.prn || "").trim().toUpperCase();

  const matchingRows = (prnResponse.data.values || [])
    .map((row, index) => ({
      prn: String(row[0] || "").trim().toUpperCase(),
      rowNumber: index + 2
    }))
    .filter(item => item.prn === targetPrn);

  if (matchingRows.length !== 1) {
    throw new Error(
      matchingRows.length === 0
        ? "No student row matched this PRN. No sheet data was changed."
        : "Multiple student rows matched this PRN. No sheet data was changed."
    );
  }

  const rowNumber = matchingRows[0].rowNumber;
  const updatedAt = new Date().toISOString();

  const updates = {
    ...(headers.includes("Name") && profile.name !== undefined ? { Name: profile.name } : {}),
    ...(headers.includes("Department") && profile.department !== undefined ? { Department: profile.department } : {}),
    Mobile: profile.mobile,
    Email: profile.email,
    CGPA: profile.cgpa,
    Current_Semester: profile.semester,
    Academic_Year: profile.academicYear,
    Profile_Status: "COMPLETED",
    Profile_Updated_At: updatedAt
  };

  const data = Object.entries(updates).map(([header, value]) => {
    const column = columnLetter(headers.indexOf(header) + 1);
    return {
      range: `${tabName}!${column}${rowNumber}`,
      values: [[value]]
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data
    }
  });

  return { rowNumber, updatedAt };
}

module.exports = {
  getGoogleSheets,
  getSpreadsheetId,
  updateStudentProfile
};
