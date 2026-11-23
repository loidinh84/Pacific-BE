const fs = require('fs');
const species = JSON.parse(fs.readFileSync('./Pacific-BE/backend/scripts/all_species_dump.json', 'utf8'));

for (let i = 0; i < species.length; i += 50) {
  const batch = species.slice(i, i + 50);
  console.log('=== BATCH ' + (i + 1) + ' to ' + (i + batch.length) + ' ===');
  batch.forEach(s => console.log(s.id + '. [' + s.code + '] ' + s.name + ' (' + s.sci + ') | ' + s.zone));
}
