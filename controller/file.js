
const xlsx=require('xlsx')

module.exports.parseExcel=async(req,res)=>{
    try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
     
        const ext = (req.file.originalname || '').toLowerCase();
        if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
          return res.status(400).json({ error: 'Only .xlsx, .xls, and .csv files are supported' });
        }
     
        
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
     
        if (!rawRows.length) {
          return res.status(422).json({ error: 'Spreadsheet appears to be empty' });
        }
     
      
        const map = {};
        rawRows.forEach((row) => {
          const address = String(row['Address'] || '').trim();
          const cityStateZip = String(row['City State Zip'] || '').trim();
          if (!address && !cityStateZip) return;
     
          const key = `${address}||${cityStateZip}`;
          if (map[key]) {
            map[key].count += 1;
          } else {
            map[key] = { address, cityStateZip, count: 1 };
          }
        });
     
        const addresses = Object.values(map).sort((a, b) => b.count - a.count);
     
        return res.json({
          rows: rawRows.length,
          addresses,
        });
      } catch (err) {
        console.error('Parse error:', err);
        return res.status(500).json({ error: 'Failed to parse file: ' + err.message });
      }
}