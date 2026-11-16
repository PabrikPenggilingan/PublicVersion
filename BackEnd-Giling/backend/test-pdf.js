try {
  const m = require('pdfmake');
  console.log('require(pdfmake) keys:', Object.keys(m));
  console.log('is m a function?', typeof m === 'function');
  console.log('is m.default a function?', typeof m.default === 'function');
} catch (e) {
  console.error('require(pdfmake) error:', e.message);
}

try {
  const p = require('pdfmake/js/Printer');
  console.log('require(pdfmake/js/Printer) keys:', Object.keys(p));
} catch (e) {
  console.error('require(pdfmake/js/Printer) error:', e.message);
}
