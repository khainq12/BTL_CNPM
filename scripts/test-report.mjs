// Báo cáo kiểm thử + ma trận truy vết yêu cầu → test case → kết quả chạy tự động.
//   node scripts/test-report.mjs [--strict]
// Đầu vào : reports/junit/*.xml (Vitest/Playwright, mỗi tầng một file) và docs/qa/WOMS_QA_Test_Cases.xlsx (bộ 58 TC của QA).
// Đầu ra  : reports/test-report.md, reports/test-report.html, reports/WOMS_QA_Ket_qua_tu_dong.xlsx (thêm sheet kết quả)
//           và tóm tắt trong GITHUB_STEP_SUMMARY khi chạy trên GitHub Actions.
// Quy ước : tên test chứa mã TC (vd "TC-021 TC-050 | ..."). Một TC đạt khi mọi test gắn mã đó đều đạt (ISTQB: Requirement → Test Case → Execution → Result).
import ExcelJS from 'exceljs'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const junitDir = join(root, 'reports', 'junit')
const outDir = join(root, 'reports')
const xlsxIn = join(root, 'docs', 'qa', 'WOMS_QA_Test_Cases.xlsx')
const strict = process.argv.includes('--strict')
const LAYER = {
  domain: 'Unit (nghiệp vụ)',
  portal: 'Unit (portal TV7)',
  'staff-web': 'Component (frontend)',
  api: 'Tích hợp API + PostgreSQL',
  e2e: 'E2E trình duyệt',
}
const TAG = /\b(TC-\d{3}|MAN-L\d{2}|BR-\d{2}|PARAM-\d{2}|UC-\d{2}|NFR-\d{2}|C\d{2})\b/g

const unescape = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

// ---- 1. Đọc JUnit ----
const tests = []
if (existsSync(junitDir)) {
  for (const f of readdirSync(junitDir).filter((x) => x.endsWith('.xml'))) {
    const layer = f.replace(/\.xml$/, '')
    const xml = readFileSync(join(junitDir, f), 'utf8')
    for (const m of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], unescape(a[2])]))
      const body = m[3] ?? ''
      const status = /<(failure|error)\b/.test(body) ? 'FAIL' : /<skipped\b/.test(body) ? 'SKIP' : 'PASS'
      const name = attrs.name ?? ''
      tests.push({
        layer,
        suite: attrs.classname ?? '',
        name,
        time: Number(attrs.time ?? 0),
        status,
        tags: [...new Set(`${attrs.classname} ${name}`.match(TAG) ?? [])],
      })
    }
  }
}
if (!tests.length) {
  console.error('Không có kết quả JUnit trong reports/junit/. Chạy kiểm thử với CI=1 trước (xem README).')
  process.exit(strict ? 1 : 0)
}

// ---- 2. Đọc bộ test case của QA ----
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(xlsxIn)
const ws = wb.getWorksheet('Test_Cases')
const header = ws.getRow(1).values.slice(1).map(String)
const col = (n) => header.indexOf(n) + 1
const tcs = []
ws.eachRow((row, i) => {
  if (i === 1) return
  const id = String(row.getCell(col('TC_ID')).value ?? '').trim()
  if (!/^TC-\d{3}$/.test(id)) return
  tcs.push({
    id,
    req: String(row.getCell(col('Requirement_ID')).value ?? ''),
    module: String(row.getCell(col('Module')).value ?? ''),
    scenario: String(row.getCell(col('Scenario')).value ?? ''),
    priority: String(row.getCell(col('Priority')).value ?? ''),
    manual: String(row.getCell(col('Execution_Status')).value ?? ''),
  })
})

// ---- 3. Ghép ----
const byTc = new Map(tcs.map((t) => [t.id, []]))
for (const t of tests) for (const tag of t.tags) if (byTc.has(tag)) byTc.get(tag).push(t)
const rows = tcs.map((tc) => {
  const ts = byTc.get(tc.id)
  const status = !ts.length ? 'CHƯA TỰ ĐỘNG' : ts.some((t) => t.status === 'FAIL') ? 'FAIL' : 'PASS'
  const layers = [...new Set(ts.map((t) => t.layer))]
  return { ...tc, status, count: ts.length, layers, tests: ts }
})
const totals = {
  tests: tests.length,
  pass: tests.filter((t) => t.status === 'PASS').length,
  fail: tests.filter((t) => t.status === 'FAIL').length,
  skip: tests.filter((t) => t.status === 'SKIP').length,
  time: tests.reduce((s, t) => s + t.time, 0),
}
const tcSum = {
  total: rows.length,
  pass: rows.filter((r) => r.status === 'PASS').length,
  fail: rows.filter((r) => r.status === 'FAIL').length,
  none: rows.filter((r) => r.status === 'CHƯA TỰ ĐỘNG').length,
}
const layers = Object.entries(Object.groupBy(tests, (t) => t.layer)).map(([k, v]) => ({
  layer: LAYER[k] ?? k,
  key: k,
  n: v.length,
  pass: v.filter((t) => t.status === 'PASS').length,
  fail: v.filter((t) => t.status === 'FAIL').length,
}))
const reqs = Object.entries(Object.groupBy(rows, (r) => r.req.split('/')[0].trim() || 'Khác')).map(([req, rs]) => ({
  req,
  total: rs.length,
  pass: rs.filter((r) => r.status === 'PASS').length,
  fail: rs.filter((r) => r.status === 'FAIL').length,
}))
const failing = tests.filter((t) => t.status === 'FAIL')
const stamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
const commit = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'

// ---- 4. Markdown ----
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')
const md = [
  `# Báo cáo kiểm thử WOMS`,
  ``,
  `Thời điểm: ${stamp} · commit \`${commit}\``,
  ``,
  `## Tổng quan`,
  ``,
  `| Chỉ số | Giá trị |`,
  `| --- | --- |`,
  `| Số test tự động đã chạy | ${totals.tests} (đạt ${totals.pass}, lỗi ${totals.fail}, bỏ qua ${totals.skip}) |`,
  `| Thời gian chạy | ${totals.time.toFixed(1)} giây |`,
  `| Test case QA (bộ 58 TC) có test tự động | ${tcSum.total - tcSum.none}/${tcSum.total} (${pct(tcSum.total - tcSum.none, tcSum.total)}) |`,
  `| Test case QA đạt | ${tcSum.pass} · lỗi ${tcSum.fail} · chưa tự động ${tcSum.none} |`,
  ``,
  `## Theo tầng kiểm thử (kim tự tháp)`,
  ``,
  `| Tầng | Số test | Đạt | Lỗi |`,
  `| --- | ---: | ---: | ---: |`,
  ...layers.map((l) => `| ${l.layer} | ${l.n} | ${l.pass} | ${l.fail} |`),
  ``,
  `## Độ phủ theo yêu cầu`,
  ``,
  `| Yêu cầu | Số TC | TC đạt | TC lỗi |`,
  `| --- | ---: | ---: | ---: |`,
  ...reqs.map((r) => `| ${r.req} | ${r.total} | ${r.pass} | ${r.fail} |`),
  ``,
  ...(failing.length ? [`## Test lỗi`, ``, ...failing.map((t) => `- **${t.layer}** · ${t.suite} › ${t.name}`), ``] : []),
  `## Ma trận truy vết (TC → kết quả tự động)`,
  ``,
  `| TC | Yêu cầu | Kịch bản | Ưu tiên | Kết quả QA 22/11 (thủ công/mock) | Kết quả tự động | Số test | Tầng |`,
  `| --- | --- | --- | --- | --- | --- | ---: | --- |`,
  ...rows.map(
    (r) =>
      `| ${r.id} | ${r.req} | ${r.scenario.replace(/\|/g, '/')} | ${r.priority} | ${r.manual || '—'} | ${r.status === 'PASS' ? '✅ PASS' : r.status === 'FAIL' ? '❌ FAIL' : '⬜ chưa tự động'} | ${r.count} | ${r.layers.join(', ')} |`
  ),
  ``,
  `TC "chưa tự động" giữ nguyên cách kiểm thủ công của nhóm QA (xem docs/qa). Chi tiết từng test: reports/junit/*.xml, báo cáo Playwright: reports/playwright/index.html.`,
].join('\n')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'test-report.md'), md)

// ---- 5. HTML (một file, mở trực tiếp hoặc tải từ artifact CI) ----
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const badge = (s) => `<span class="b ${s === 'PASS' ? 'ok' : s === 'FAIL' ? 'bad' : 'mut'}">${esc(s)}</span>`
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Báo cáo kiểm thử WOMS</title>
<style>:root{--bg:#f6f7f7;--fg:#1d2b2a;--mut:#5d6f6c;--ln:#dbe2e0;--ok:#1f7a4d;--okb:#e2f3ea;--bad:#b3261e;--badb:#fbe4e1;--card:#fff}
@media(prefers-color-scheme:dark){:root{--bg:#101716;--fg:#e2ecea;--mut:#9db0ad;--ln:#2a3a38;--ok:#6fd3a0;--okb:#173326;--bad:#ff8a80;--badb:#3d1d1a;--card:#172120}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,"Segoe UI",sans-serif}main{max-width:1200px;margin:0 auto;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}.mut{color:var(--mut)}.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:16px}
.k{background:var(--card);border:1px solid var(--ln);border-radius:10px;padding:14px}.k b{display:block;font-size:26px}table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--ln);border-radius:10px;overflow:hidden}
th,td{padding:7px 9px;border-bottom:1px solid var(--ln);text-align:left;vertical-align:top}th{color:var(--mut);font-weight:600;font-size:12px}.b{padding:2px 8px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap}
.ok{background:var(--okb);color:var(--ok)}.bad{background:var(--badb);color:var(--bad)}.mut.b{background:var(--ln)}details summary{cursor:pointer;color:var(--mut)}.wrap{overflow-x:auto}</style></head><body><main>
<h1>Báo cáo kiểm thử WOMS</h1><div class="mut">${esc(stamp)} · commit ${esc(commit)}</div>
<div class="kpi"><div class="k">Test tự động<b>${totals.tests}</b><span class="mut">${totals.pass} đạt · ${totals.fail} lỗi</span></div>
<div class="k">Tỷ lệ đạt<b>${pct(totals.pass, totals.tests)}</b><span class="mut">${totals.time.toFixed(1)} giây</span></div>
<div class="k">TC QA có test tự động<b>${tcSum.total - tcSum.none}/${tcSum.total}</b><span class="mut">${pct(tcSum.total - tcSum.none, tcSum.total)} bộ 58 TC</span></div>
<div class="k">TC QA đạt<b>${tcSum.pass}</b><span class="mut">${tcSum.fail} lỗi · ${tcSum.none} chưa tự động</span></div></div>
<h2>Theo tầng kiểm thử</h2><div class="wrap"><table><tr><th>Tầng</th><th>Số test</th><th>Đạt</th><th>Lỗi</th></tr>${layers.map((l) => `<tr><td>${esc(l.layer)}</td><td>${l.n}</td><td>${l.pass}</td><td>${l.fail}</td></tr>`).join('')}</table></div>
<h2>Ma trận truy vết</h2><div class="wrap"><table><tr><th>TC</th><th>Yêu cầu</th><th>Kịch bản</th><th>Ưu tiên</th><th>QA 22/11</th><th>Tự động</th><th>Test</th></tr>
${rows.map((r) => `<tr><td>${r.id}</td><td>${esc(r.req)}</td><td>${esc(r.scenario)}</td><td>${esc(r.priority)}</td><td>${esc(r.manual)}</td><td>${badge(r.status)}</td><td>${r.count ? `<details><summary>${r.count} test · ${esc(r.layers.join(', '))}</summary>${r.tests.map((t) => `<div>${badge(t.status)} ${esc(t.name)}</div>`).join('')}</details>` : '—'}</td></tr>`).join('\n')}
</table></div><p class="mut">Quy ước: tên test chứa mã TC. TC đạt khi mọi test gắn mã đó đều đạt. TC chưa tự động giữ cách kiểm thủ công của nhóm QA.</p></main></body></html>`
writeFileSync(join(outDir, 'test-report.html'), html)

// ---- 6. Excel: thêm sheet kết quả vào file của QA (không sửa các sheet cũ) ----
const sheetName = `Auto_${new Date().toISOString().slice(0, 10)}`
const old = wb.getWorksheet(sheetName)
if (old) wb.removeWorksheet(old.id)
const out = wb.addWorksheet(sheetName)
out.columns = [
  { header: 'TC_ID', key: 'id', width: 9 },
  { header: 'Requirement_ID', key: 'req', width: 16 },
  { header: 'Scenario', key: 'scenario', width: 60 },
  { header: 'Priority', key: 'priority', width: 9 },
  { header: 'QA_22_11', key: 'manual', width: 18 },
  { header: 'Auto_Status', key: 'status', width: 16 },
  { header: 'Auto_Tests', key: 'count', width: 10 },
  { header: 'Layers', key: 'layers', width: 30 },
  { header: 'Test_Names', key: 'names', width: 100 },
]
for (const r of rows) out.addRow({ ...r, layers: r.layers.join(', '), names: r.tests.map((t) => `[${t.status}] ${t.name}`).join('\n') })
out.getRow(1).font = { bold: true }
out.views = [{ state: 'frozen', ySplit: 1 }]
out.eachRow((row, i) => {
  if (i === 1) return
  const c = row.getCell('status')
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.value === 'PASS' ? 'FFE2F3EA' : c.value === 'FAIL' ? 'FFFBE4E1' : 'FFEDEFEE' } }
  row.alignment = { vertical: 'top', wrapText: true }
})
await wb.xlsx.writeFile(join(outDir, 'WOMS_QA_Ket_qua_tu_dong.xlsx'))

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.split('## Ma trận truy vết')[0])
console.log(
  `Báo cáo: ${totals.tests} test (${totals.pass} đạt, ${totals.fail} lỗi). TC có test tự động ${tcSum.total - tcSum.none}/${tcSum.total}, đạt ${tcSum.pass}.`
)
console.log(`→ reports/test-report.md, reports/test-report.html, reports/WOMS_QA_Ket_qua_tu_dong.xlsx`)
if (strict && totals.fail) process.exit(1)
