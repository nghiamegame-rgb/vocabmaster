import { execFileSync } from 'node:child_process';

// Independent standard-library ZIP/XML reader, not the writer's implementation.
// Reads stdin only; never touches real user files or production services.
export function inspectXlsx(bytes) {
  return JSON.parse(execFileSync('python', ['-c', String.raw`
import io, json, sys, zipfile, posixpath
import xml.etree.ElementTree as ET
z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
assert z.testzip() is None
for name in z.namelist():
    if name.endswith('.xml') or name.endswith('.rels'): ET.fromstring(z.read(name))
content_types = ET.fromstring(z.read('[Content_Types].xml'))
assert any(item.get('PartName') == '/xl/workbook.xml' and item.get('ContentType') == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml' for item in content_types)
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
workbook = ET.fromstring(z.read('xl/workbook.xml'))
rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
targets = {r.attrib['Id']: r.attrib['Target'] for r in rels}
strings = []
if 'xl/sharedStrings.xml' in z.namelist():
    strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml'))]
result = []
for sheet in workbook.find('m:sheets', ns):
    rid = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
    target = targets[rid]
    path = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('xl', target))
    xml = ET.fromstring(z.read(path))
    rows = []
    for row in xml.findall('m:sheetData/m:row', ns):
        cells = []
        for c in row.findall('m:c', ns):
            typ = c.get('t')
            value = c.findtext('m:v', '', ns)
            if typ == 's': value = strings[int(value)]
            elif typ == 'inlineStr': value = ''.join(c.find('m:is', ns).itertext())
            cells.append({'ref': c.get('r'), 'type': typ, 'value': value})
        rows.append(cells)
    result.append({'name': sheet.get('name'), 'rows': rows, 'formulas': len(xml.findall('.//m:f', ns))})
print(json.dumps({'sheets': result, 'parts': z.namelist()}))
`], { input: bytes, maxBuffer: 20 * 1024 * 1024 }).toString());
}
