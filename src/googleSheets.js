const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let cachedToken = null;
let tokenExpiresAt = 0;

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || Object.prototype.hasOwnProperty.call(process.env, match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function getServiceAccount() {
  loadLocalEnv();
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyFile) throw new Error("Google service-account key path is not configured.");

  const resolvedPath = path.resolve(keyFile);
  const account = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  if (!account.client_email || !account.private_key) {
    throw new Error("The configured service-account JSON is missing required credentials.");
  }
  return account;
}

async function getAccessToken(account) {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) return cachedToken;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + "." + claim;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + "." + signer.sign(account.private_key, "base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error("Google authorization failed. Check the service account configuration.");
  }

  cachedToken = result.access_token;
  tokenExpiresAt = Date.now() + Number(result.expires_in || 3600) * 1000;
  return cachedToken;
}

async function sheetsRequest(endpoint, options = {}) {
  loadLocalEnv();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not configured.");

  const account = getServiceAccount();
  const token = await getAccessToken(account);
  const response = await fetch(
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      encodeURIComponent(spreadsheetId) + "/" + endpoint,
    {
      ...options,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const result = await response.json();
  if (!response.ok) {
    const reason = result && result.error && result.error.message;
    throw new Error("Google Sheets request failed: " + (reason || response.statusText));
  }
  return result;
}

function columnLetter(number) {
  let result = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }
  return result;
}

async function updateStudentProfile(profile) {
  const tabName = "Students";
  const headerResponse = await sheetsRequest(
    "values/" + encodeURIComponent(tabName + "!1:1")
  );
  const headers = headerResponse.values?.[0] || [];
  const requiredHeaders = [
    "PRN", "Mobile", "Email", "CGPA", "Current_Semester",
    "Academic_Year", "Profile_Status", "Profile_Updated_At"
  ];

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error("Google Sheet is missing the required column: " + header);
    }
  }

  const prnColumn = columnLetter(headers.indexOf("PRN") + 1);
  const prnResponse = await sheetsRequest(
    "values/" + encodeURIComponent(tabName + "!" + prnColumn + "2:" + prnColumn)
  );
  const targetPrn = String(profile.prn || "").trim().toUpperCase();
  const matches = (prnResponse.values || [])
    .map((row, index) => ({
      prn: String(row[0] || "").trim().toUpperCase(),
      rowNumber: index + 2
    }))
    .filter(row => row.prn === targetPrn);

  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? "No student row matched this PRN. No sheet data was changed."
      : "Multiple student rows matched this PRN. No sheet data was changed.");
  }

  const rowNumber = matches[0].rowNumber;
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
      range: tabName + "!" + column + rowNumber,
      values: [[value]]
    };
  });

  await sheetsRequest("values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "RAW",
      data
    })
  });

  return { rowNumber, updatedAt };
}

module.exports = { updateStudentProfile };
