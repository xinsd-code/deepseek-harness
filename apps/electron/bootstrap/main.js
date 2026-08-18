void import(new URL('../app/lib/main.js', import.meta.url).href).catch((error) => {
  console.error('[dsh-desktop] bootstrap failed:', error)
  process.exitCode = 1
})
