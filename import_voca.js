const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'MVP Vol. 1 어휘 목록★.xlsx';

if (!fs.existsSync(filePath)) {
    console.error(`Error: ${filePath} not found.`);
    process.exit(1);
}

const workbook = xlsx.readFile(filePath);
console.log('Sheets found:', workbook.SheetNames);

// The user says words from B3. 
// I'll assume they are organized per sheet or there is a "Day" column.
// If there are many sheets, I'll treat each sheet as a Day or a group.
// Most VOCA files have "DAY 1", "DAY 2" as sheets.

let allVoca = [];

workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    let count = 0;
    // B3 means column B (index 1), Row 3 (index 2)
    // sheet_to_json header: 1 gives an array of arrays
    for(let r = 2; r < data.length; r++) {
        const row = data[r];
        if (row && row[1]) {
            const word = String(row[1]).trim();
            if (word) {
                allVoca.push({
                    day: sheetName,
                    word: word
                });
                count++;
            }
        }
        if (count >= 50) break; // Limit to 50 words per Day (sheet)
    }
});

// Save to VOCA.csv
const csvContent = 'Day,Word\n' + allVoca.map(v => `"${v.day}","${v.word}"`).join('\n');
fs.writeFileSync('VOCA.csv', csvContent, 'utf-8');

console.log(`Successfully saved ${allVoca.length} words to VOCA.csv`);
