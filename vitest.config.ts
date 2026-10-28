import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30000 },
  resolve: { alias: { 'server-only': new URL('./tests/server-only-stub.ts', import.meta.url).pathname } },
})
