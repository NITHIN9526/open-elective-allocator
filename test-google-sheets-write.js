
require("dotenv").config();

const { google } = require("googleapis");
const path = require("path");

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!spreadsheetId || !keyFile) {
    throw new Error("Missing Google Sheets environment variables in .env");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(keyFile),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({
    version: "v4",
    auth
  });

  // Create a unique temporary tab so existing data is untouched.
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);

  const tabName = `Integration_Test_${timestamp}`;

  console.log("Creating test tab:", tabName);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: tabName
            }
          }
        }
      ]
    }
  });

  const testId = `TEST_${Date.now()}`;

  const testData = [
    ["Test_ID", "Test_Name", "Status"],
    [testId, "Open Elective Integration Test", "SUCCESS"]
  ];

  // Write test data.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!A1:C2`,
    valueInputOption: "RAW",
    requestBody: {
      values: testData
    }
  });

  console.log("Write operation completed.");

  // Read back and verify.
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!A1:C2`
  });

  const returnedData = response.data.values || [];

  console.log("\nREAD-BACK RESULT:");
  console.log(returnedData);

  if (
    returnedData[1]?.[0] === testId &&
    returnedData[1]?.[2] === "SUCCESS"
  ) {
    console.log("\nSUCCESS: Google Sheets WRITE and READ verified.");
    console.log("Test tab:", tabName);
  } else {
    throw new Error("Write verification failed.");
  }
}

main().catch(error => {
  console.error("\nGOOGLE SHEETS TEST FAILED:");
  console.error(error.message);
  process.exitCode = 1;
});
