// const xlsx = require('xlsx');

// module.exports.parseExcel = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: 'No file uploaded' });
//     }

//     const ext = (req.file.originalname || '').toLowerCase();
//     if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
//       return res.status(400).json({ error: 'Only .xlsx, .xls, and .csv files are supported' });
//     }

//     const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
//     const sheetName = workbook.SheetNames[0];
//     const sheet = workbook.Sheets[sheetName];
//     const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

//     if (!rawRows.length) {
//       return res.status(422).json({ error: 'Spreadsheet appears to be empty' });
//     }

//     // Detect format by checking first row's keys
//     const firstRow = rawRows[0];
//     const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());

//     const isPrimaryCompetitor = keys.includes('primary') || keys.includes('competitor');
//     const isAddressFormat = keys.includes('address') || keys.includes('city state zip');

//     if (!isPrimaryCompetitor && !isAddressFormat) {
//       return res.status(422).json({
//         error: 'Unrecognized format. Expected columns: "primary"/"competitor" OR "Address"/"City State Zip"'
//       });
//     }

//     const primaryMap = {};
//     const competitorMap = {};

//     rawRows.forEach((row) => {
//       console.log("ROW")
//       console.log(row)
//       if (isPrimaryCompetitor) {
//         // Format: { primary: "Name, Address, City, ST", competitor: "Name, Address, City, ST" }
//         const primaryRaw    = String(row['primary']    || row['Primary']    || '').trim();
//         const competitorRaw = String(row['competitor'] || row['Competitor'] || '').trim();

//         if (primaryRaw) {
//           primaryMap[primaryRaw] = (primaryMap[primaryRaw] || 0) + 1;
//         }
//         if (competitorRaw) {
//           competitorMap[competitorRaw] = (competitorMap[competitorRaw] || 0) + 1;
//         }
//       } else {
//         // Legacy format: { Address: "...", "City State Zip": "..." }
//         const address      = String(row['Address']        || '').trim();
//         const cityStateZip = String(row['City State Zip'] || '').trim();
//         if (!address && !cityStateZip) return;
//         const key = `${address}||${cityStateZip}`;
//         if (primaryMap[key]) {
//           primaryMap[key].count += 1;
//         } else {
//           primaryMap[key] = { address, cityStateZip, count: 1 };
//         }
//       }
//     });

//     if (isPrimaryCompetitor) {
//       // Convert maps to arrays with parsed name + address
//       const parseEntry = (raw) => {
//         // Format: "Name, Street Address, City, ST"  (last part is "City, ST" or "City, ST ZIP")
//         const parts = raw.split(',').map(p => p.trim());
//         const name    = parts[0] || raw;
//         const address = parts.slice(1).join(', ').trim() || raw;
//         return { name, address, fullAddress: raw };
//       };

//       const primaries   = Object.entries(primaryMap).map(([raw, count]) => ({ ...parseEntry(raw), count, type: 'primary' }));
//       const competitors = Object.entries(competitorMap).map(([raw, count]) => ({ ...parseEntry(raw), count, type: 'competitor' }));

//       const allAddresses = [...primaries, ...competitors].sort((a, b) => b.count - a.count);

//       return res.json({
//         rows: rawRows.length,
//         addresses: allAddresses,
//         format: 'primary-competitor',
//       });
//     } else {
//       // Legacy format response
//       const addresses = Object.entries(primaryMap)
//         .map(([key, val]) => val)
//         .sort((a, b) => b.count - a.count);

//       return res.json({
//         rows: rawRows.length,
//         addresses,
//         format: 'address-zip',
//       });
//     }
//   } catch (err) {
//     console.error('Parse error:', err);
//     return res.status(500).json({ error: 'Failed to parse file: ' + err.message });
//   }
// };




const xlsx = require('xlsx');


const REGION_BOUNDS = { minLat: 32.0, maxLat: 35.5, minLng: -83.5, maxLng: -78.5 };

function simplifyAddress(addr) {
  return addr
    .replace(/\s*(entrance\s*[a-z]|ste\s*[\w]+|suite\s*[\w]+|unit\s*[\w]+|apt\s*[\w]+|#[\w]+)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


async function geocodeAddress(fullAddress) {
  for (const query of [fullAddress, simplifyAddress(fullAddress)]) {
    if (!query) continue;
    try {
      await sleep(300);
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      const feature = data?.features?.[0];
      if (feature) {
        const [lng, lat] = feature.geometry.coordinates;
        console.log(`[GEO] "${query}" → lat:${lat} lng:${lng}`);
        return [lat, lng];
      } else {
        console.log(`[GEO] No result for "${query}"`);
      }
    } catch (err) { console.error(`[GEO ERROR] "${query}":`, err.message); }
  }
  return null;
}

module.exports.parseExcel = async (req, res) => {
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

    const firstRow = rawRows[0];
    const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());

    const isPrimaryCompetitor = keys.includes('primary') || keys.includes('competitor');
    const isAddressFormat = keys.includes('address') || keys.includes('city state zip');
    const isEmployeeFormat = keys.some(k => k.includes('address line')) && keys.some(k => k.includes('city, state zip'));
    
    if (!isPrimaryCompetitor && !isAddressFormat && !isEmployeeFormat) {
      return res.status(422).json({
        error: 'Unrecognized format. Expected columns: "primary"/"competitor" OR "Address"/"City State Zip" OR employee directory format'
      });
    }



    const primaryMap = {};
    const competitorMap = {};

   
    // Find exact column names for employee format
    const addressLineKey   = Object.keys(rawRows[0] || {}).find(k => k.toLowerCase().includes('address line'));
    const cityStateZipKey  = Object.keys(rawRows[0] || {}).find(k => k.toLowerCase().includes('city, state zip'));

    rawRows.forEach((row) => {
      console.log("ROW")
      console.log(row)
      if (isPrimaryCompetitor) {
        const primaryRaw    = String(row['primary']    || row['Primary']    || '').trim();
        const competitorRaw = String(row['competitor'] || row['Competitor'] || '').trim();
        if (primaryRaw)    primaryMap[primaryRaw]    = (primaryMap[primaryRaw]    || 0) + 1;
        if (competitorRaw) competitorMap[competitorRaw] = (competitorMap[competitorRaw] || 0) + 1;
      } else if (isEmployeeFormat) {
        const address      = String(row[addressLineKey]  || '').trim();
        const cityStateZip = String(row[cityStateZipKey] || '').trim();
        if (!address && !cityStateZip) return;
        const key = `${address}||${cityStateZip}`;
        if (primaryMap[key]) primaryMap[key].count += 1;
        else primaryMap[key] = { address, cityStateZip, count: 1 };
      } else {
        const address      = String(row['Address']        || '').trim();
        const cityStateZip = String(row['City State Zip'] || '').trim();
        if (!address && !cityStateZip) return;
        const key = `${address}||${cityStateZip}`;
        if (primaryMap[key]) primaryMap[key].count += 1;
        else primaryMap[key] = { address, cityStateZip, count: 1 };
      }
    });

    if (isPrimaryCompetitor) {
      const parseEntry = (raw) => {
        const parts = raw.split(',').map(p => p.trim());
        const name    = parts[0] || raw;
        const address = parts.slice(1).join(', ').trim() || raw;
        return { name, address, fullAddress: raw };
      };

      const primaries   = Object.entries(primaryMap).map(([raw, count]) => ({ ...parseEntry(raw), count, type: 'primary' }));
      const competitors = Object.entries(competitorMap).map(([raw, count]) => ({ ...parseEntry(raw), count, type: 'competitor' }));
      const allEntries  = [...primaries, ...competitors];

      // Geocode server-side with bounds check
      const geocoded = [];
      for (const entry of allEntries) {
        const coords = await geocodeAddress(entry.fullAddress) || await geocodeAddress(entry.address);
        console.log(`[GEO] "${entry.name}" → ${coords ? coords : 'null (skipped)'}`);
        if (coords) geocoded.push({ ...entry, coords });
      }

      return res.json({
        rows: rawRows.length,
        addresses: geocoded.sort((a, b) => b.count - a.count),
        format: 'primary-competitor',
      });

    } else {
      const addressEntries = Object.entries(primaryMap)
      .map(([key, val]) => val)
      .sort((a, b) => b.count - a.count);

    // For employee format, geocode server-side so we can use the reliable geocoder
    if (isEmployeeFormat) {
      const geocoded = [];
      for (const entry of addressEntries) {
        const fullAddress = `${entry.address}, ${entry.cityStateZip}`;
        const coords = await geocodeAddress(fullAddress) || await geocodeAddress(entry.cityStateZip);
        console.log(`[GEO] "${fullAddress}" → ${coords ? coords : 'null (skipped)'}`);
        if (coords) geocoded.push({ ...entry, coords });
      }
      return res.json({
        rows: rawRows.length,
        addresses: geocoded,
        format: 'employee',
      });
    }

    return res.json({
      rows: rawRows.length,
      addresses: addressEntries,
      format: 'address-zip',
    });
    
    }
  } catch (err) {
    console.error('Parse error:', err);
    return res.status(500).json({ error: 'Failed to parse file: ' + err.message });
  }
};