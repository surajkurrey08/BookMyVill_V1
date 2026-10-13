import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { seoPages, prerenderedSeoPaths } from './src/seoPages.js'

const SITE_URL = 'https://bookmyvilla.online'

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

function updateMeta(html, attribute, key, content) {
  const tag = new RegExp(`<meta\\s+${attribute}="${key}"[^>]*>`, 'i')
  return html.replace(tag, `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`)
}

function prerenderSeoPages() {
  return {
    name: 'prerender-seo-pages',
    async writeBundle({ dir }) {
      const outputDir = resolve(dir || 'dist')
      const indexHtml = await readFile(resolve(outputDir, 'index.html'), 'utf8')

      for (const path of prerenderedSeoPaths) {
        const page = seoPages[path]
        const canonicalPath = page.canonical || path
        const canonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`
        let html = indexHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`)
        html = updateMeta(html, 'name', 'description', page.description)
        html = updateMeta(html, 'name', 'robots', page.noindex ? 'noindex,follow' : 'index,follow')
        html = updateMeta(html, 'property', 'og:title', page.title)
        html = updateMeta(html, 'property', 'og:description', page.description)
        html = updateMeta(html, 'property', 'og:url', canonicalUrl)
        html = html.replace(
          /<link\s+rel="canonical"[^>]*>/i,
          `<link rel="canonical" href="${canonicalUrl}" />`
        )
        html = updateMeta(html, 'name', 'twitter:title', page.title)
        html = updateMeta(html, 'name', 'twitter:description', page.description)

        const pageDir = path === '/' ? outputDir : resolve(outputDir, path.slice(1))
        await mkdir(pageDir, { recursive: true })
        await writeFile(resolve(pageDir, 'index.html'), html)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), prerenderSeoPages()],
  base: '/',
  server: {
    port: 5173,
    strictPort: true,
    host: true
  }
})
