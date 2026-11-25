# Converte a planilha oficial da TACO 4a edição (NEPA/Unicamp) para o CSV de scripts/import-taco.mjs.
# Fonte: https://nepa.unicamp.br/publicacoes/tabela-taco-excel/
# Uso: python scripts/taco-xlsx-to-csv.py Taco-4a-Edicao.xlsx data/taco.csv
# Só usa a biblioteca padrão. Alimentos sem kcal analisada ("*" ou "NA") ficam de fora.
import csv
import sys, zipfile, re, xml.etree.ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
RNS='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
def load(path):
    z=zipfile.ZipFile(path)
    ss=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS['m'])))
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rmap={r.get('Id'):r.get('Target') for r in rels}
    sheets=[]
    for s in wb.find('m:sheets',NS):
        t=rmap[s.get(RNS)].lstrip('/'); t=t if t.startswith('xl/') else 'xl/'+t
        rows=[]
        for r in ET.fromstring(z.read(t)).iter('{%s}row'%NS['m']):
            row={}
            for c in r.findall('m:c',NS):
                col=re.match(r'[A-Z]+',c.get('r')).group()
                v=c.find('m:v',NS); typ=c.get('t')
                if typ=='s' and v is not None: val=ss[int(v.text)]
                elif typ=='inlineStr': val=''.join(x.text or '' for x in c.iter('{%s}t'%NS['m']))
                else: val=v.text if v is not None else ''
                row[col]=val
            rows.append((int(r.get('r')),row))
        sheets.append((s.get('name'),rows))
    return sheets
src, out = sys.argv[1], sys.argv[2]
name, rows = load(src)[0]
COLS = {'kcal':'D','proteina':'F','lipideos':'G','carboidrato':'I','fibra':'J','sodio':'R'}
def val(v):
    v = (v or '').strip()
    if not v or re.fullmatch(r'(?i)tr|na|\*|-', v): return v.upper() if v else ''
    return f"{float(v):.2f}".rstrip('0').rstrip('.')
cat = None; data = []; warn = []; skipped = []
for n, r in rows[3:]:
    a, b = (r.get('A') or '').strip(), (r.get('B') or '').strip()
    if a and not a.isdigit() and not b:
        if not re.match(r'(?i)n.mero|alimento$', a): cat = a
        continue
    if not a.isdigit() or not b: continue
    if '"' in b: warn.append(f"aspas no nome: {b}")
    rec = {'codigo': a, 'nome': b, 'categoria': cat}
    for k, c in COLS.items(): rec[k] = val(r.get(c))
    if not re.fullmatch(r'[0-9.]+', rec['kcal']):
        skipped.append(f"{a} {b} (kcal={rec['kcal'] or 'vazio'})"); continue
    data.append(rec)
with open(out, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['codigo','nome','categoria','kcal','proteina','lipideos','carboidrato','fibra','sodio'])
    w.writeheader(); w.writerows(data)
codes = [int(d['codigo']) for d in data]
print('alimentos', len(data), 'codigos', min(codes), '-', max(codes), 'duplicados', len(codes)-len(set(codes)))
print('categorias', sorted({d['categoria'] for d in data}))
print(*warn, sep='\n')
print('fora (sem kcal):'); [print('  ', x) for x in skipped]
