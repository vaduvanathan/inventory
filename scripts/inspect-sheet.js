const { google } = require('googleapis');
const path = require('path');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1T8Nb_3BcCbaU27ZMvhGfZ3y7FzIkmVy_3lpL7Kewg64';

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    console.log('Spreadsheet Title:', meta.data.properties.title);
    
    for (const sheet of meta.data.sheets) {
      const sheetName = sheet.properties.title;
      console.log(`\n--- Sheet: ${sheetName} ---`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z1`, // Get headers
      });
      
      const rows = response.data.values;
      if (rows && rows.length > 0) {
        console.log('Headers:', rows[0].join(', '));
      } else {
        console.log('Empty sheet or no headers.');
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();