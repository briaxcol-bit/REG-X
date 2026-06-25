const ts = require('typescript');
const fs = require('fs');
for (const f of ['src/modules/platform/pages/TenantsPage.tsx','src/router/index.tsx']) {
  const code = fs.readFileSync(f,'utf8');
  const sf = ts.createSourceFile(f, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const diags = sf.parseDiagnostics || [];
  console.log('===', f, 'diags:', diags.length);
  for (const d of diags.slice(0,5)) {
    const pos = sf.getLineAndCharacterOfPosition(d.start);
    console.log(`  L${pos.line+1}:${pos.character+1}`, ts.flattenDiagnosticMessageText(d.messageText,'\n'));
    console.log('    near:', JSON.stringify(code.slice(d.start-40, d.start+40)));
  }
}
