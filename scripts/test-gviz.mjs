const id = '1FRsIFruvudBQzKBPcCEm27SErnol9FkRNUDLPE_SKMI';
for (const gid of ['0', '999999']) {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&gid=${gid}`);
  const t = await r.text();
  console.log('gid', gid, 'status', r.status, 'ok', t.includes('"status":"ok"'));
}
const bad = await fetch('https://docs.google.com/spreadsheets/d//gviz/tq?tqx=out:json&gid=0');
console.log('empty id status', bad.status);
