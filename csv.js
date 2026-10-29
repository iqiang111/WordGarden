// Quote every cell, and neutralize spreadsheet formulas in user-authored content.
function cell(value) {
  const text = String(value ?? '');
  const safe = /^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
function exportResponses(data, english = false) {
  const rows = [english ? ['Question', 'User IP', 'Original response'] : ['问题', '用户 IP', '原始发言']];
  for (const response of data.submissions) rows.push([data.question, response.ip || (english ? 'IP not recorded' : '未记录 IP'), response.text]);
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
module.exports = { exportResponses };
