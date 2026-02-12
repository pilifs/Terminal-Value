// domain/utils.js

const generateSeats = (layout, basePrice) => {
  const seats = [];
  const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  layout.forEach((rowStr, r) => {
    let seatNum = 1;
    rowStr.split('').forEach((char, c) => {
      if (char === '.' || char === '_') return;
      const isVip = char === 'V';
      seats.push({
        id: `${rowLabels[r]}-${seatNum}`,
        r,
        c,
        row: rowLabels[r],
        number: seatNum,
        status: 'AVAILABLE',
        tier: isVip ? 'VIP' : 'STANDARD',
        price: isVip ? Math.floor(basePrice * 1.5) : basePrice,
      });
      seatNum++;
    });
  });
  return seats;
};

module.exports = { generateSeats };
