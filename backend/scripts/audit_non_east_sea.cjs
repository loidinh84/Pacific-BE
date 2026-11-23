const fs = require('fs');
const species = JSON.parse(fs.readFileSync('./Pacific-BE/backend/scripts/all_species_dump.json', 'utf8'));

const nonEastSea = [
  { id: 2, sci: 'Enteroctopus dofleini', reason: 'Bạch tuộc khổng lồ Bắc Thái Bình Dương (vùng nước lạnh Alaska, Bắc Mỹ, Nga), không thuộc Biển Đông nhiệt đới.' },
  { id: 131, sci: 'Acropora cervicornis', reason: 'San hô sừng hươu Caribe (đặc hữu Đại Tây Dương/Caribe; loài tương đương ở Biển Đông là Acropora muricata).' },
  { id: 193, sci: 'Lagenorhynchus obliquidens', reason: 'Cá heo răng khía (vùng ôn đới lạnh Bắc Thái Bình Dương - Alaska, Nhật Bản), không phân bố tại Biển Đông.' },
  { id: 245, sci: 'Grimpoteuthis discoveryi', reason: 'Bạch tuộc Dumbo Bắc Đại Tây Dương (vực thẳm Porcupine ngoài khơi Ireland), không thuộc Biển Đông.' },
  { id: 250, sci: 'Syringammina fragilissima', reason: 'Trùng lỗ khổng lồ đáy thẳm Bắc Đại Tây Dương (ngoài khơi Scotland), không có ghi nhận tại Biển Đông.' },
  { id: 260, sci: 'Torpedo californica', reason: 'Cá đuối điện California (đặc hữu ven bờ đông bắc Thái Bình Dương: California - Canada), không thuộc Biển Đông.' },
  { id: 265, sci: 'Phycodurus eques', reason: 'Cá rồng biển lá (đặc hữu nghiêm ngặt vùng nước mát phía nam và tây nước Úc), không thuộc Biển Đông.' },
  { id: 269, sci: 'Eptatretus stoutii', reason: 'Cá phù thủy Thái Bình Dương (vùng biển đông bắc Thái Bình Dương: Alaska đến Mexico), không thuộc Biển Đông.' },
  { id: 275, sci: 'Pseudocarcinus gigas', reason: 'Cua khổng lồ Tasmania (đặc hữu vùng biển lạnh nam nước Úc và đảo Tasmania), không thuộc Biển Đông.' },
  { id: 285, sci: 'Ophiura sarsii', reason: 'Sao giòn Ophiura sarsii (vùng biển cận cực Bắc Băng Dương và bắc Đại Tây Dương), không thuộc Biển Đông.' }
];

console.log('Total non-East Sea identified:', nonEastSea.length);
nonEastSea.forEach(n => {
  const found = species.find(s => s.id === n.id);
  console.log('- ID ' + n.id + ': ' + (found ? found.name : 'Unknown') + ' (' + n.sci + ') -> ' + n.reason);
});
