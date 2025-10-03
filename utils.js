(function(root){
  function parseLine(line, layout){
    const record = {};
    for(const field of layout){
      let value = line.substring(field.start, field.end);
      if(field.trim) value = value.trim();
      record[field.name] = (field.type === 'float') ? (parseFloat(value) / 100 || 0) : value;
    }
    return record;
  }

  function getVoucherKey(voucher){
    return `${String(voucher.tipoCbte || '').trim()}-${String(voucher.puntoVenta || '').trim()}-${String(voucher.numeroCbte || '').trim()}`;
  }

  function validateCuit(cuit){
    if(!/^\d{11}$/.test(cuit)) return false;
    const multipliers = [5,4,3,2,7,6,5,4,3,2];
    let sum = 0;
    for(let i=0;i<10;i++) sum += parseInt(cuit[i]) * multipliers[i];
    let checkDigit = 11 - (sum % 11);
    if(checkDigit === 11) checkDigit = 0;
    if(checkDigit === 10) checkDigit = 9;
    return checkDigit === parseInt(cuit[10]);
  }

  function validateDate(dateStr){
    if(!/^\d{8}$/.test(dateStr)) return false;
    const year = parseInt(dateStr.substring(0,4));
    const month = parseInt(dateStr.substring(4,6));
    const day = parseInt(dateStr.substring(6,8));
    const d = new Date(year, month-1, day);
    return d.getFullYear()===year && d.getMonth()===month-1 && d.getDate()===day;
  }

  // Export to browser and commonjs
  if(typeof window !== 'undefined'){
    window.parseLine = parseLine;
    window.getVoucherKey = getVoucherKey;
    window.validateCuit = validateCuit;
    window.validateDate = validateDate;
  }
  if(typeof module !== 'undefined' && module.exports){
    module.exports = { parseLine, getVoucherKey, validateCuit, validateDate };
  }
})(this);
