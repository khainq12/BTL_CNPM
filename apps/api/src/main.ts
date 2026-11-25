import { bootstrap } from './app.factory'

bootstrap().catch((e) => {
  console.error(e)
  process.exit(1)
})
