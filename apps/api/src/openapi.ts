import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { buildOpenApi, createApp } from './app.factory'

// Xuất đặc tả OpenAPI ra file (CI đính kèm làm artifact; nhóm frontend đối chiếu hợp đồng API).
async function main() {
  const out = resolve(process.argv[2] ?? 'openapi.json')
  const app = await createApp({ logger: false })
  await app.init()
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(buildOpenApi(app), null, 2))
  await app.close()
  console.log(`OpenAPI: ${out}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
