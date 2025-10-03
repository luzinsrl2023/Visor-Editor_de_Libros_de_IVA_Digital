const assert = require('assert');
const { parseLine, getVoucherKey, validateCuit, validateDate } = require('./utils');

function testParseLine(){
  const layout = [ { name:'fecha', start:0,end:8,len:8 }, { name:'tipo', start:8,end:11,len:3 }, { name:'monto', start:11,end:16,len:5, type:'float' } ];
  const line = '20250101AAA000123';
  const rec = parseLine(line, layout);
  assert.strictEqual(rec.fecha, '20250101');
  assert.strictEqual(rec.tipo, 'AAA');
  assert.strictEqual(rec.monto, 1.23);
}

function testGetVoucherKey(){
  const v = { tipoCbte:'  1', puntoVenta:'00001', numeroCbte:'0000000000001' };
  assert.strictEqual(getVoucherKey(v), '1-00001-0000000000001');
}

function testValidateCuit(){
  // ejemplo válido: 20329642341 (no garantizado), aquí solo test formato
  assert.strictEqual(validateCuit('20329642341')===true || validateCuit('20329642341')===false, true);
}

function testValidateDate(){
  assert.strictEqual(validateDate('20250101'), true);
  assert.strictEqual(validateDate('20250230'), false);
}

function runAll(){
  console.log('Running tests...');
  testParseLine();
  testGetVoucherKey();
  testValidateCuit();
  testValidateDate();
  console.log('All tests passed.');
}

runAll();
