
require('dotenv').config();

const { google } = require('googleapis');
const path = require('path');

async function testGoogleSheets() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const keyFile = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '');

    if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      throw new Error('Missing Google Sheets configuration in .env');
    }

    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const client = await auth.getClient();

    const sheets = google.sheets({
      version: 'v4',
      auth: client
    });

    const response = await sheets.spreadsheets.get({
      spreadsheetId
    });

    console.log('\nGoogle Sheets connection successful!');
    console.log('Spreadsheet:', response.data.properties.title);
    console.log('\nAvailable tabs:');

    response.data.sheets.forEach(sheet => {
      console.log('-', sheet.properties.title);
    });

  } catch (error) {
    console.error('\nGoogle Sheets connection failed:');
    console.error(error.message);
    process.exitCode = 1;
  }
}

testGoogleSheets();
