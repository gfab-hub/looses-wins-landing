#!/usr/bin/env node
/**
 * Builds the static blog of loosesandwins.com (GitHub Pages) from the published articles of the platform:
 *   GET <public-api>?blog=1 → { posts, topics }
 * Writes blog/index.html, blog/tema/<topic>/index.html, blog/<slug>/index.html, blog/rss.xml and sitemap.xml.
 * Run by .github/workflows/blog.yml (on demand from the admin panel and every hour). Needs: node ≥ 20, `marked`.
 *
 *   BLOG_API=https://<ref>.supabase.co/functions/v1/public-api node scripts/build-blog.mjs
 */
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { marked } from 'marked';

const API = process.env.BLOG_API;
const SITE = 'https://loosesandwins.com';
const APP = 'https://app.loosesandwins.com';
if (!API) { console.error('BLOG_API missing'); process.exit(1); }

const res = await fetch(`${API}?blog=1`);
if (!res.ok) { console.error('API', res.status, await res.text()); process.exit(1); }
const { posts, topics } = await res.json();
const topicOf = (slug) => topics.find((t) => t.slug === slug) ?? { slug, label: slug, description: '' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const date = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
// Markdown → HTML; raw HTML in the article is escaped (articles come from an automatic writer)
// photos inside an article: only https, shown as a figure with the description and the licence credit (title)
const image = ({ href, title, text }) => /^https:\/\//.test(href ?? '')
  ? `<figure class="fig"><img src="${esc(href)}" alt="${esc(text)}" loading="lazy">${text || title ? `<figcaption>${esc(text)}${title ? `<span>${esc(title)}</span>` : ''}</figcaption>` : ''}</figure>`
  : '';
marked.use({ renderer: { html: ({ text }) => esc(text), image }, gfm: true });
const md = (s) => marked.parse(String(s ?? ''));

const CSS = `
:root{--canvas:oklch(0.982 0.003 255);--card:#fff;--ink:oklch(0.145 0 0);--muted:oklch(0.556 0 0);--border:oklch(0.925 0.004 255);--brand:oklch(0.52 0.13 255);--brand-deep:oklch(0.42 0.13 258);--sans:"Geist",-apple-system,"Segoe UI",system-ui,sans-serif;--r:14px;--shadow:0 1px 2px rgb(15 23 42/.04),0 4px 14px -6px rgb(15 23 42/.08)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--canvas);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--brand);text-decoration:none}img{max-width:100%;height:auto}
.wrap{max-width:1160px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left))}
.nav{position:sticky;top:0;z-index:20;background:rgb(255 255 255/.8);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;height:64px}
.logo{display:flex;align-items:center;gap:10px;color:var(--ink);font-weight:700;letter-spacing:-.01em}
.logo b{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;color:#fff;font-size:11px;font-weight:800;background:linear-gradient(135deg,var(--brand),oklch(0.42 0.16 285))}
.nav-links{display:flex;gap:22px;font-size:.92rem}.nav-links a{color:var(--muted)}.nav-links a:hover,.nav-links a.on{color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:10px 18px;border-radius:12px;font-weight:600;font-size:.95rem}
.btn-primary{color:#fff;background:linear-gradient(180deg,color-mix(in oklch,var(--brand) 88%,white),var(--brand));box-shadow:0 1px 0 rgb(255 255 255/.25) inset,0 8px 22px -8px color-mix(in oklch,var(--brand) 70%,transparent)}
.btn-ghost{background:#fff;color:var(--ink);border:1px solid var(--border)}
.hero{padding:56px 0 26px}.chip{display:inline-flex;gap:8px;align-items:center;font-size:.8rem;font-weight:500;color:var(--brand);background:color-mix(in oklch,var(--brand) 9%,white);border:1px solid color-mix(in oklch,var(--brand) 18%,white);padding:5px 12px;border-radius:999px}.chip i{width:6px;height:6px;border-radius:50%;background:var(--brand)}
h1{font-size:clamp(2rem,4.4vw,3.1rem);line-height:1.08;letter-spacing:-.035em;margin:14px 0 10px}
.lead{color:var(--muted);font-size:1.08rem;max-width:640px;margin:0}
.topics{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 6px}.topics a{padding:7px 14px;border-radius:999px;border:1px solid var(--border);background:#fff;color:var(--ink);font-size:.9rem}.topics a.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;padding:18px 0 56px}
.card{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow);color:var(--ink);transition:transform .2s,box-shadow .2s}.card:hover{transform:translateY(-2px);box-shadow:0 18px 40px -22px rgb(15 23 42/.35)}
.cover{aspect-ratio:16/9;background:linear-gradient(135deg,var(--brand),oklch(0.42 0.16 285));display:grid;place-items:center;color:#fff;font-weight:800;font-size:1.6rem;letter-spacing:-.02em;overflow:hidden}.cover img{width:100%;height:100%;object-fit:cover;display:block}
.card .body{padding:16px 18px 18px;display:grid;gap:8px}.meta{font-size:.8rem;color:var(--muted)}.card h2,.card h3{font-size:1.12rem;line-height:1.3;margin:0;letter-spacing:-.01em}.card p{margin:0;color:var(--muted);font-size:.93rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.feature{grid-column:1/-1;display:grid;grid-template-columns:1.3fr 1fr}.feature .cover{aspect-ratio:auto;min-height:280px}.feature h2{font-size:1.6rem}@media(max-width:760px){.feature{grid-template-columns:1fr}.nav-links{display:none}}
.article{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:40px;padding:36px 0 70px}@media(max-width:960px){.article{grid-template-columns:1fr}}
.prose{font-size:1.06rem;line-height:1.75}.prose h2{font-size:1.45rem;letter-spacing:-.02em;margin:2em 0 .6em}.prose h3{font-size:1.15rem;margin:1.6em 0 .5em}.prose p{margin:0 0 1.1em}.prose ul,.prose ol{padding-left:1.3em;margin:0 0 1.2em}.prose li{margin:.35em 0}.prose blockquote{margin:1.4em 0;padding:12px 18px;border-left:4px solid var(--brand);background:#fff;border-radius:0 10px 10px 0;color:var(--muted)}.prose a{text-decoration:underline}.prose table{border-collapse:collapse;width:100%;margin:1.2em 0;font-size:.95rem}.prose th,.prose td{border:1px solid var(--border);padding:8px 10px;text-align:left}.prose code{background:#eef1f6;padding:2px 6px;border-radius:6px;font-size:.9em}
.art-cover{border-radius:var(--r);overflow:hidden;margin:18px 0 6px;box-shadow:var(--shadow)}.credit{font-size:.78rem;color:var(--muted);margin:0 0 22px}.prose p:has(>figure){margin:0}.fig{margin:1.8em 0}.fig img{width:100%;border-radius:var(--r);box-shadow:var(--shadow);display:block}.fig figcaption{font-size:.85rem;color:var(--muted);margin-top:8px}.fig figcaption span{display:block;font-size:.75rem;opacity:.8}
.side{position:sticky;top:84px;align-self:start;display:grid;gap:14px}
.cta{background:linear-gradient(160deg,var(--brand),oklch(0.42 0.16 285));color:#fff;border-radius:18px;padding:22px;box-shadow:0 24px 50px -24px color-mix(in oklch,var(--brand) 80%,transparent)}.cta h3{margin:0 0 6px;font-size:1.2rem;letter-spacing:-.01em}.cta p{margin:0 0 14px;color:rgb(255 255 255/.85);font-size:.93rem}.cta .btn{width:100%}.cta .btn-primary{background:#fff;color:var(--brand-deep);box-shadow:none}.cta .btn-ghost{background:transparent;color:#fff;border-color:rgb(255 255 255/.45);margin-top:8px}
.box{background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:16px 18px;font-size:.92rem}.box h4{margin:0 0 8px;font-size:.95rem}.box ul{margin:0;padding-left:1.1em}.box li{margin:.3em 0}
.endcta{margin:34px 0 0;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;background:#fff;border:1px solid var(--border);border-radius:18px;padding:22px 24px;box-shadow:var(--shadow)}.endcta h3{margin:0 0 4px}.endcta p{margin:0;color:var(--muted)}
.sources{margin-top:30px;font-size:.9rem}.sources h2{font-size:1.05rem}
.crumbs{font-size:.85rem;color:var(--muted);margin-bottom:6px}.crumbs a{color:var(--muted)}
footer{border-top:1px solid var(--border);padding:28px 0 40px;color:var(--muted);font-size:.85rem}footer .wrap{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
@media(max-width:960px){.side{position:static}}
`;

const head = (o) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title><meta name="description" content="${esc(o.description)}"><link rel="canonical" href="${o.url}">
<meta property="og:type" content="${o.type ?? 'website'}"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.description)}"><meta property="og:url" content="${o.url}">${o.image ? `<meta property="og:image" content="${esc(o.image)}">` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="alternate" type="application/rss+xml" title="Blog de LOOSES &amp; WINS" href="${SITE}/blog/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap">
<style>${CSS}</style>${o.jsonld ? `<script type="application/ld+json">${JSON.stringify(o.jsonld)}</script>` : ''}</head><body>
<header class="nav"><div class="wrap"><a class="logo" href="/"><b>L&amp;W</b>LOOSES &amp; WINS</a>
<nav class="nav-links"><a href="/#como">Cómo funciona</a><a href="/#funciones">Funciones</a><a href="/#precios">Precios</a><a href="/blog/" class="on">Blog</a></nav>
<a class="btn btn-primary" href="/#precios">Empieza gratis</a></div></header>`;

const foot = () => `<footer><div class="wrap"><span>© ${new Date().getFullYear()} LOOSES &amp; WINS · El beneficio real de tu tienda online</span><span><a href="/">Inicio</a> · <a href="/#precios">Planes</a> · <a href="/blog/rss.xml">RSS</a></span></div></footer></body></html>`;

const cover = (p, big = false) => p.cover_url ? `<div class="cover"><img src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || p.title)}" loading="${big ? 'eager' : 'lazy'}"></div>` : `<div class="cover">L&amp;W</div>`;
const card = (p, feature = false) => `<a class="card${feature ? ' feature' : ''}" href="/blog/${p.slug}/">${cover(p, feature)}<div class="body"><div class="meta">${esc(topicOf(p.topic).label)} · ${date(p.published_at)} · ${p.reading_minutes} min</div>${feature ? '<h2>' : '<h3>'}${esc(p.title)}${feature ? '</h2>' : '</h3>'}<p>${esc(p.excerpt)}</p></div></a>`;
const topicNav = (on) => `<div class="topics"><a href="/blog/"${on ? '' : ' class="on"'}>Todo</a>${topics.map((t) => `<a href="/blog/tema/${t.slug}/"${on === t.slug ? ' class="on"' : ''}>${esc(t.label)}</a>`).join('')}</div>`;

const out = (path, html) => { mkdirSync(path.replace(/\/[^/]*$/, ''), { recursive: true }); writeFileSync(path, html); };

// fresh blog folder every build (removed / unpublished articles disappear)
if (existsSync('blog')) for (const d of ['tema']) rmSync(`blog/${d}`, { recursive: true, force: true });
const keep = new Set(['rss.xml', 'tema', 'index.html']);
if (existsSync('blog')) for (const name of (await import('node:fs')).readdirSync('blog')) if (!keep.has(name)) rmSync(`blog/${name}`, { recursive: true, force: true });

// index
out('blog/index.html', head({ title: 'Blog de e-commerce, Shopify, Meta Ads y normativa | LOOSES & WINS', description: 'Noticias y guías para tiendas online: novedades de Shopify y Meta Ads, normativa e IVA, márgenes y beneficio real.', url: `${SITE}/blog/` })
  + `<main class="wrap"><section class="hero"><span class="chip"><i></i>Blog</span><h1>Lo que mueve el e-commerce, cada día</h1><p class="lead">Novedades de Shopify y Meta Ads, normativa e impuestos para vender online y estrategias para ganar más con cada pedido.</p>${topicNav(null)}</section>`
  + (posts.length ? `<div class="grid">${posts.map((p, i) => card(p, i === 0)).join('')}</div>` : '<p class="lead" style="padding:40px 0 80px">Muy pronto, los primeros artículos.</p>')
  + `</main>${foot()}`);

// topics
for (const t of topics) {
  const list = posts.filter((p) => p.topic === t.slug);
  out(`blog/tema/${t.slug}/index.html`, head({ title: `${t.label} | Blog de LOOSES & WINS`, description: t.description || `Artículos sobre ${t.label}.`, url: `${SITE}/blog/tema/${t.slug}/` })
    + `<main class="wrap"><section class="hero"><div class="crumbs"><a href="/blog/">Blog</a> / ${esc(t.label)}</div><h1>${esc(t.label)}</h1><p class="lead">${esc(t.description)}</p>${topicNav(t.slug)}</section>`
    + (list.length ? `<div class="grid">${list.map((p) => card(p)).join('')}</div>` : '<p class="lead" style="padding:40px 0 80px">Muy pronto, los primeros artículos de este tema.</p>')
    + `</main>${foot()}`);
}

// articles
for (const p of posts) {
  const t = topicOf(p.topic);
  const related = posts.filter((x) => x.slug !== p.slug && x.topic === p.topic).slice(0, 3);
  const url = `${SITE}/blog/${p.slug}/`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.seo_description || p.excerpt, datePublished: p.published_at, dateModified: p.updated_at, mainEntityOfPage: url, image: p.cover_url || undefined, author: { '@type': 'Organization', name: 'LOOSES & WINS', url: SITE }, publisher: { '@type': 'Organization', name: 'LOOSES & WINS', url: SITE }, articleSection: t.label, keywords: (p.tags || []).join(', ') };
  out(`blog/${p.slug}/index.html`, head({ title: `${p.title} | LOOSES & WINS`, description: p.seo_description || p.excerpt, url, image: p.cover_url, type: 'article', jsonld })
    + `<main class="wrap"><div class="article"><article>
<div class="crumbs"><a href="/blog/">Blog</a> / <a href="/blog/tema/${t.slug}/">${esc(t.label)}</a></div>
<h1>${esc(p.title)}</h1><div class="meta">${date(p.published_at)} · ${p.reading_minutes} min de lectura</div>
${p.cover_url ? `<div class="art-cover"><img src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || p.title)}"></div>${p.cover_credit ? `<p class="credit">${esc(p.cover_credit)}</p>` : ''}` : '<div style="height:18px"></div>'}
<div class="prose">${md(p.content)}</div>
<div class="endcta"><div><h3>¿Cuánto ganas de verdad con cada pedido?</h3><p>LOOSES &amp; WINS une Shopify, tus costes, tus anuncios y tus facturas y te enseña el beneficio real. Empieza gratis, sin tarjeta.</p></div><a class="btn btn-primary" href="${APP}/signup/?plan=free">Empieza gratis</a></div>
${(p.sources || []).length ? `<section class="sources"><h2>Fuentes</h2><ul>${p.sources.map((s) => `<li><a href="${esc(s.url)}" rel="nofollow noopener" target="_blank">${esc(s.title)}</a></li>`).join('')}</ul></section>` : ''}
</article>
<aside class="side"><div class="cta"><h3>Tu beneficio real, pedido a pedido</h3><p>Shopify, AliExpress, Meta Ads, IVA y gastos en un solo sitio. Sin hojas de cálculo.</p><a class="btn btn-primary" href="${APP}/signup/?plan=free">Empieza gratis</a><a class="btn btn-ghost" href="/#precios">Ver planes</a></div>
${related.length ? `<div class="box"><h4>Más de ${esc(t.label)}</h4><ul>${related.map((r) => `<li><a href="/blog/${r.slug}/">${esc(r.title)}</a></li>`).join('')}</ul></div>` : ''}
</aside></div></main>
<script>try{fetch(${JSON.stringify(API)},{method:'POST',body:JSON.stringify({action:'blog_view',slug:${JSON.stringify(p.slug)}}),keepalive:true})}catch(e){}</script>${foot()}`);
}

// RSS + sitemap
const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Blog de LOOSES &amp; WINS</title><link>${SITE}/blog/</link><description>E-commerce, Shopify, Meta Ads y normativa para tiendas online.</description><language>es-es</language>
${posts.slice(0, 50).map((p) => `<item><title>${esc(p.title)}</title><link>${SITE}/blog/${p.slug}/</link><guid>${SITE}/blog/${p.slug}/</guid><pubDate>${new Date(p.published_at).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description><category>${esc(topicOf(p.topic).label)}</category></item>`).join('\n')}
</channel></rss>`;
writeFileSync('blog/rss.xml', rss);
const urls = [`${SITE}/`, `${SITE}/blog/`, ...topics.map((t) => `${SITE}/blog/tema/${t.slug}/`), ...posts.map((p) => `${SITE}/blog/${p.slug}/`)];
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`);
if (!existsSync('robots.txt') || !readFileSync('robots.txt', 'utf8').includes('Sitemap')) writeFileSync('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`blog: ${posts.length} articles, ${topics.length} topics`);
