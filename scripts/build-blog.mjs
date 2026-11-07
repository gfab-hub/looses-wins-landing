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

// headings get an id (table of contents); «Las claves» list becomes a highlighted box; tables scroll on phones
const slugId = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
marked.use({ renderer: {
  heading({ tokens, depth }) { const html = this.parser.parseInline(tokens); return `<h${depth} id="${slugId(html)}">${html}</h${depth}>\n`; },
} });
const article = (content) => md(content)
  .replace(/(<h2 id="las-claves[^"]*">[\s\S]*?<\/h2>\s*)(<ul>[\s\S]*?<\/ul>)/, '<div class="keys">$1$2</div>')
  .replace(/<table>/g, '<div class="tbl"><table>').replace(/<\/table>/g, '</table></div>');
const toc = (content) => [...content.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].replace(/[*_`]/g, '').trim());

// one accent per topic (pills, badges, covers without photo)
const ACCENT = { ecommerce: '#2563eb', shopify: '#16a34a', meta: '#6d28d9', normativa: '#c2410c' };
const accent = (slug) => ACCENT[slug] ?? '#2563eb';

const CSS = `
:root{--canvas:#f7f8fb;--card:#fff;--ink:#0b1220;--ink2:#334155;--muted:#64748b;--border:#e6e9f0;--brand:#2563eb;--sans:"Geist",-apple-system,"Segoe UI",system-ui,sans-serif;--serif:"Newsreader",Georgia,serif;--r:18px;--shadow:0 1px 2px rgb(15 23 42/.05),0 10px 30px -14px rgb(15 23 42/.18)}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:90px}body{margin:0;background:var(--canvas);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--brand);text-decoration:none}img{max-width:100%;height:auto}
.wrap{max-width:1180px;margin:0 auto;padding:0 16px}.narrow{max-width:780px;margin:0 auto;padding:0 16px}
.nav{position:sticky;top:0;z-index:30;background:rgb(255 255 255/.78);backdrop-filter:saturate(1.6) blur(14px);-webkit-backdrop-filter:saturate(1.6) blur(14px);border-bottom:1px solid rgb(230 233 240/.8)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;height:66px}
.logo{display:flex;align-items:center;gap:10px;color:var(--ink);font-weight:750;letter-spacing:-.01em}
.logo b{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;color:#fff;font-size:11px;font-weight:800;background:linear-gradient(135deg,#3b82f6,#4f46e5 60%,#7c3aed);box-shadow:0 6px 16px -6px #4f46e5}
.nav-links{display:flex;gap:26px;font-size:.93rem}.nav-links a{color:var(--muted);font-weight:500}.nav-links a:hover,.nav-links a.on{color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 20px;border-radius:12px;font-weight:600;font-size:.95rem;transition:transform .15s,box-shadow .15s}.btn:hover{transform:translateY(-1px)}
.btn-primary{color:#fff;background:linear-gradient(180deg,#3b82f6,#2563eb);box-shadow:0 1px 0 rgb(255 255 255/.25) inset,0 10px 24px -10px #2563eb}
.btn-ghost{background:#fff;color:var(--ink);border:1px solid var(--border)}
.hero{position:relative;overflow:hidden;padding:72px 0 34px;background:radial-gradient(900px 380px at 12% -10%,rgb(59 130 246/.16),transparent 60%),radial-gradient(700px 360px at 95% 0%,rgb(124 58 237/.14),transparent 60%)}
.eyebrow{display:inline-flex;gap:8px;align-items:center;font-size:.78rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--brand);background:#fff;border:1px solid #dbe5ff;padding:6px 12px;border-radius:999px;box-shadow:var(--shadow)}.eyebrow i{width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#7c3aed)}
.hero h1{font-size:clamp(2.2rem,5.2vw,3.7rem);line-height:1.04;letter-spacing:-.045em;margin:18px 0 14px;max-width:820px;font-weight:800}
.hero h1 em{font-style:normal;background:linear-gradient(90deg,#2563eb,#7c3aed);-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{color:var(--ink2);font-size:1.13rem;max-width:640px;margin:0}
.topics{display:flex;flex-wrap:wrap;gap:8px;margin:28px 0 0}.topics a{display:inline-flex;align-items:center;gap:8px;padding:8px 15px;border-radius:999px;border:1px solid var(--border);background:#fff;color:var(--ink);font-size:.9rem;font-weight:500;transition:border-color .15s}.topics a:hover{border-color:#c7d2e5}.topics a i{width:8px;height:8px;border-radius:50%}.topics a.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:22px;padding:28px 0 64px}
.card{position:relative;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow);color:var(--ink);transition:transform .25s cubic-bezier(.2,0,0,1),box-shadow .25s}.card:hover{transform:translateY(-4px);box-shadow:0 28px 60px -28px rgb(15 23 42/.45)}
.cover{position:relative;aspect-ratio:16/9;display:grid;place-items:center;color:#fff;font-weight:800;font-size:2rem;letter-spacing:-.03em;overflow:hidden}.cover img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .6s cubic-bezier(.2,0,0,1)}.card:hover .cover img{transform:scale(1.04)}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:.74rem;font-weight:650;letter-spacing:.02em;padding:4px 10px;border-radius:999px;color:var(--c);background:color-mix(in srgb,var(--c) 10%,white);border:1px solid color-mix(in srgb,var(--c) 22%,white)}
.cover .badge{position:absolute;left:14px;top:14px;background:rgb(255 255 255/.92);backdrop-filter:blur(6px)}
.card .body{padding:18px 20px 20px;display:flex;flex-direction:column;gap:10px;flex:1}.card h2,.card h3{font-size:1.17rem;line-height:1.3;margin:0;letter-spacing:-.015em;font-weight:700}.card p{margin:0;color:var(--muted);font-size:.94rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.by{display:flex;align-items:center;gap:10px;margin-top:auto;padding-top:6px;font-size:.82rem;color:var(--muted)}.av{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;flex:none;color:#fff;font-size:9px;font-weight:800;background:linear-gradient(135deg,#3b82f6,#7c3aed)}.by b{color:var(--ink);font-weight:600}
.feature{grid-column:1/-1;display:grid;grid-template-columns:1.25fr 1fr}.feature .cover{aspect-ratio:auto;min-height:360px}.feature .body{padding:34px 34px 30px;justify-content:center;gap:14px}.feature h2{font-size:clamp(1.5rem,2.6vw,2.1rem);line-height:1.15;letter-spacing:-.03em}.feature p{-webkit-line-clamp:4;font-size:1.02rem}
.more{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--brand);font-size:.92rem}
@media(max-width:820px){.feature{grid-template-columns:1fr}.feature .cover{min-height:220px}.feature .body{padding:20px}.nav-links{display:none}}
.band{margin:0 0 70px;border-radius:24px;padding:38px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;color:#fff;background:radial-gradient(600px 240px at 0% 0%,rgb(255 255 255/.18),transparent 60%),linear-gradient(120deg,#1d4ed8,#4f46e5 55%,#7c3aed);box-shadow:0 30px 60px -30px #4f46e5}.band h2{margin:0 0 6px;font-size:clamp(1.4rem,2.6vw,1.9rem);letter-spacing:-.03em}.band p{margin:0;color:rgb(255 255 255/.85);max-width:560px}.band .btn-primary{background:#fff;color:#1d4ed8;box-shadow:none}.band .btn-ghost{background:transparent;color:#fff;border-color:rgb(255 255 255/.4)}.band .acts{display:flex;gap:10px;flex-wrap:wrap}
@media(max-width:600px){.band{padding:26px 22px}}
.progress{position:fixed;left:0;top:0;height:3px;width:0;z-index:40;background:linear-gradient(90deg,#3b82f6,#7c3aed)}
.ahead{padding:46px 16px 10px;text-align:center}.crumbs{font-size:.85rem;color:var(--muted);margin-bottom:16px}.crumbs a{color:var(--muted)}.crumbs a:hover{color:var(--ink)}
.ahead h1{font-size:clamp(2rem,4.6vw,3.2rem);line-height:1.08;letter-spacing:-.04em;margin:16px 0 14px;font-weight:800}
.dek{font-family:var(--serif);font-size:clamp(1.15rem,2vw,1.35rem);line-height:1.5;color:var(--ink2);margin:0 auto;max-width:680px}
.ahead .by{justify-content:center;margin-top:22px;font-size:.88rem}.ahead .av{width:36px;height:36px;font-size:11px}
.acover{max-width:1080px;margin:30px auto 0;padding:0 16px}.acover img{width:100%;aspect-ratio:2/1;object-fit:cover;border-radius:24px;box-shadow:0 30px 70px -35px rgb(15 23 42/.55);display:block}.credit{font-size:.76rem;color:var(--muted);margin:10px 0 0;text-align:right}
.article{display:grid;grid-template-columns:minmax(0,720px) 290px;justify-content:center;gap:56px;padding:40px 16px;max-width:1180px;margin:0 auto}@media(max-width:1000px){.article{grid-template-columns:minmax(0,1fr);gap:28px}}
.prose{font-size:1.1rem;line-height:1.8;color:#1e293b}.prose>p:first-of-type{font-size:1.2rem;color:var(--ink)}
.prose h2{font-size:1.65rem;line-height:1.25;letter-spacing:-.025em;margin:2.2em 0 .7em;color:var(--ink)}.prose h3{font-size:1.25rem;margin:1.8em 0 .5em;color:var(--ink)}.prose p{margin:0 0 1.2em}
.prose ul,.prose ol{padding-left:1.3em;margin:0 0 1.3em}.prose li{margin:.45em 0}.prose li::marker{color:var(--brand)}
.prose a{text-decoration:underline;text-decoration-color:rgb(37 99 235/.35);text-underline-offset:3px}.prose a:hover{text-decoration-color:var(--brand)}
.prose strong{color:var(--ink)}.prose blockquote{margin:1.6em 0;padding:18px 22px;border-left:4px solid var(--brand);background:#fff;border-radius:0 14px 14px 0;color:var(--ink2);font-family:var(--serif);font-size:1.2rem;box-shadow:var(--shadow)}
.prose code{background:#eef2f9;padding:2px 6px;border-radius:6px;font-size:.88em}.prose hr{border:0;border-top:1px solid var(--border);margin:2.4em 0}
.tbl{overflow-x:auto;margin:1.6em 0;border:1px solid var(--border);border-radius:14px;background:#fff;box-shadow:var(--shadow)}.prose table{border-collapse:collapse;width:100%;font-size:.95rem;line-height:1.5}.prose th{background:#f3f6fb;font-weight:650;color:var(--ink)}.prose th,.prose td{padding:11px 14px;text-align:left;border-bottom:1px solid var(--border)}.prose tr:last-child td{border-bottom:0}.prose tbody tr:nth-child(even){background:#fafbfd}
.keys{margin:1.8em 0 2em;padding:22px 24px 10px;border-radius:18px;background:linear-gradient(180deg,#eff5ff,#fff);border:1px solid #d6e3ff}.keys h2{margin:0 0 .5em;font-size:1.05rem;letter-spacing:.04em;text-transform:uppercase;color:var(--brand)}.keys ul{list-style:none;padding:0}.keys li{position:relative;padding-left:30px}.keys li::before{content:"";position:absolute;left:0;top:.45em;width:18px;height:18px;border-radius:50%;background:var(--brand) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12l5 5L20 7'/%3E%3C/svg%3E") center/11px no-repeat}
.prose p:has(>figure){margin:0}.fig{margin:2em 0}.fig img{width:100%;border-radius:16px;box-shadow:var(--shadow);display:block}.fig figcaption{font-size:.86rem;color:var(--muted);margin-top:10px;line-height:1.45}.fig figcaption span{display:block;font-size:.74rem;opacity:.8}
.side{position:sticky;top:90px;align-self:start;display:grid;gap:16px}@media(max-width:1000px){.side{position:static}}
.toc{background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px 18px;box-shadow:var(--shadow)}.toc h4{margin:0 0 8px;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.toc ol{margin:0;padding:0;list-style:none;counter-reset:t}.toc li{counter-increment:t}.toc a{display:flex;gap:10px;padding:6px 8px;border-radius:8px;color:var(--ink2);font-size:.9rem;line-height:1.35}.toc a::before{content:counter(t,decimal-leading-zero);color:#94a3b8;font-variant-numeric:tabular-nums;font-size:.8rem;padding-top:1px}.toc a:hover,.toc a.on{background:#f1f5fd;color:var(--ink)}.toc a.on::before{color:var(--brand)}
@media(max-width:1000px){.toc{display:none}}
.cta{position:relative;overflow:hidden;background:linear-gradient(150deg,#1d4ed8,#4f46e5 60%,#7c3aed);color:#fff;border-radius:20px;padding:24px;box-shadow:0 26px 50px -26px #4f46e5}.cta::after{content:"";position:absolute;right:-60px;top:-60px;width:180px;height:180px;border-radius:50%;background:rgb(255 255 255/.1)}.cta h3{margin:0 0 10px;font-size:1.22rem;letter-spacing:-.015em}.cta ul{margin:0 0 16px;padding:0;list-style:none;font-size:.9rem;display:grid;gap:6px;color:rgb(255 255 255/.9)}.cta li::before{content:"✓  ";font-weight:800}.cta .btn{width:100%;position:relative;z-index:1}.cta .btn-primary{background:#fff;color:#1d4ed8;box-shadow:none}.cta .btn-ghost{background:transparent;color:#fff;border-color:rgb(255 255 255/.45);margin-top:8px}
.share{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:34px 0 0;padding-top:22px;border-top:1px solid var(--border);font-size:.88rem;color:var(--muted)}.share a,.share button{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;border:1px solid var(--border);background:#fff;color:var(--ink);font:inherit;font-weight:500;cursor:pointer}.share a:hover,.share button:hover{border-color:#c7d2e5}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:18px}.tags span{font-size:.8rem;padding:4px 10px;border-radius:999px;background:#eef2f9;color:var(--ink2)}
.endcta{margin:34px 0 0;display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between;background:#fff;border:1px solid var(--border);border-radius:20px;padding:24px 26px;box-shadow:var(--shadow)}.endcta h3{margin:0 0 4px;font-size:1.2rem;letter-spacing:-.015em}.endcta p{margin:0;color:var(--muted);max-width:460px}
.sources{margin-top:30px;padding:18px 20px;background:#fff;border:1px solid var(--border);border-radius:16px;font-size:.9rem}.sources h2{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}.sources ul{margin:0;padding-left:1.1em}.sources li{margin:.3em 0}
.related{padding:20px 16px 70px}.related h2{font-size:1.5rem;letter-spacing:-.025em;margin:0}.related .grid{padding-top:18px}
footer{border-top:1px solid var(--border);background:#fff;padding:30px 0 40px;color:var(--muted);font-size:.86rem}footer .wrap{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}footer a{color:var(--muted)}footer a:hover{color:var(--ink)}
`;

const head = (o) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title><meta name="description" content="${esc(o.description)}"><link rel="canonical" href="${o.url}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:site_name" content="LOOSES &amp; WINS"><meta property="og:locale" content="es_ES"><meta property="og:type" content="${o.type ?? 'website'}"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.description)}"><meta property="og:url" content="${o.url}">${o.image ? `<meta property="og:image" content="${esc(o.image)}"><meta name="twitter:image" content="${esc(o.image)}">` : ''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(o.title)}"><meta name="twitter:description" content="${esc(o.description)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="alternate" type="application/rss+xml" title="Blog de LOOSES &amp; WINS" href="${SITE}/blog/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap">
<style>${CSS}</style>${o.jsonld ? `<script type="application/ld+json">${JSON.stringify(o.jsonld)}</script>` : ''}</head><body>
<header class="nav"><div class="wrap"><a class="logo" href="/"><b>L&amp;W</b>LOOSES &amp; WINS</a>
<nav class="nav-links"><a href="/#como">Cómo funciona</a><a href="/#funciones">Funciones</a><a href="/#precios">Precios</a><a href="/blog/" class="on">Blog</a></nav>
<a class="btn btn-primary" href="${APP}/signup/?plan=free">Empieza gratis</a></div></header>`;

const foot = () => `<footer><div class="wrap"><span>© ${new Date().getFullYear()} LOOSES &amp; WINS · El beneficio real de tu tienda online</span><span><a href="/">Inicio</a> · <a href="/#precios">Planes</a> · <a href="/blog/">Blog</a> · <a href="/blog/rss.xml">RSS</a></span></div></footer></body></html>`;

const badge = (slug) => `<span class="badge" style="--c:${accent(slug)}">${esc(topicOf(slug).label)}</span>`;
const byline = (p, long = false) => `<div class="by"><span class="av">L&amp;W</span><span><b>Redacción LOOSES &amp; WINS</b> · ${date(p.published_at)} · ${p.reading_minutes} min${long ? ' de lectura' : ''}</span></div>`;
const cover = (p, big = false) => p.cover_url
  ? `<div class="cover"><img src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || p.title)}" loading="${big ? 'eager' : 'lazy'}">${badge(p.topic)}</div>`
  : `<div class="cover" style="background:linear-gradient(135deg,${accent(p.topic)},#4f46e5)">L&amp;W${badge(p.topic)}</div>`;
const card = (p, feature = false) => `<a class="card${feature ? ' feature' : ''}" href="/blog/${p.slug}/">${cover(p, feature)}<div class="body">${feature ? `<h2>${esc(p.title)}</h2>` : `<h3>${esc(p.title)}</h3>`}<p>${esc(p.excerpt)}</p>${feature ? '<span class="more">Leer artículo →</span>' : ''}${byline(p)}</div></a>`;
const topicNav = (on) => `<div class="topics"><a href="/blog/"${on ? '' : ' class="on"'}>Todo</a>${topics.map((t) => `<a href="/blog/tema/${t.slug}/"${on === t.slug ? ' class="on"' : ''}><i style="background:${accent(t.slug)}"></i>${esc(t.label)}</a>`).join('')}</div>`;
const band = () => `<section class="band"><div><h2>¿Cuánto ganas de verdad con cada pedido?</h2><p>LOOSES &amp; WINS une Shopify, tus proveedores, tus anuncios y tus facturas y te enseña el beneficio real de cada pedido. Empieza gratis, sin tarjeta.</p></div><div class="acts"><a class="btn btn-primary" href="${APP}/signup/?plan=free">Empieza gratis</a><a class="btn btn-ghost" href="/#precios">Ver planes</a></div></section>`;

const out = (path, html) => { mkdirSync(path.replace(/\/[^/]*$/, ''), { recursive: true }); writeFileSync(path, html); };

// fresh blog folder every build (removed / unpublished articles disappear)
if (existsSync('blog')) for (const d of ['tema']) rmSync(`blog/${d}`, { recursive: true, force: true });
const keep = new Set(['rss.xml', 'tema', 'index.html']);
if (existsSync('blog')) for (const name of (await import('node:fs')).readdirSync('blog')) if (!keep.has(name)) rmSync(`blog/${name}`, { recursive: true, force: true });

const listing = (list, empty) => list.length ? `<div class="grid">${list.map((p, i) => card(p, i === 0 && list.length > 2)).join('')}</div>` : `<p class="lead" style="padding:40px 0 80px">${empty}</p>`;
const blogLd = { '@context': 'https://schema.org', '@type': 'Blog', name: 'Blog de LOOSES & WINS', url: `${SITE}/blog/`, publisher: { '@type': 'Organization', name: 'LOOSES & WINS', url: SITE } };

// index
out('blog/index.html', head({ title: 'Blog de e-commerce, Shopify, Meta Ads y normativa | LOOSES & WINS', description: 'Noticias y guías para tiendas online: novedades de Shopify y Meta Ads, normativa e IVA, márgenes y beneficio real.', url: `${SITE}/blog/`, jsonld: blogLd })
  + `<section class="hero"><div class="wrap"><span class="eyebrow"><i></i>Blog de LOOSES &amp; WINS</span><h1>Lo que mueve el e-commerce, <em>explicado para vender con beneficio</em></h1><p class="lead">Novedades de Shopify y Meta Ads, normativa e impuestos para vender online y estrategias para ganar más con cada pedido. Cada día, contrastado y al grano.</p>${topicNav(null)}</div></section>`
  + `<main class="wrap">${listing(posts, 'Muy pronto, los primeros artículos.')}${band()}</main>${foot()}`);

// topics
for (const t of topics) {
  const list = posts.filter((p) => p.topic === t.slug);
  out(`blog/tema/${t.slug}/index.html`, head({ title: `${t.label} | Blog de LOOSES & WINS`, description: t.description || `Artículos sobre ${t.label}.`, url: `${SITE}/blog/tema/${t.slug}/` })
    + `<section class="hero"><div class="wrap"><div class="crumbs"><a href="/blog/">Blog</a> / ${esc(t.label)}</div><span class="eyebrow"><i style="background:${accent(t.slug)}"></i>${esc(t.label)}</span><h1>${esc(t.label)}</h1><p class="lead">${esc(t.description)}</p>${topicNav(t.slug)}</div></section>`
    + `<main class="wrap">${listing(list, 'Muy pronto, los primeros artículos de este tema.')}${band()}</main>${foot()}`);
}

// articles
const PAGE_JS = `<script>(()=>{const b=document.querySelector('.progress'),a=document.querySelector('.prose');addEventListener('scroll',()=>{if(!a)return;const r=a.getBoundingClientRect(),h=r.height-innerHeight*.6;b.style.width=Math.min(100,Math.max(0,-r.top/h*100))+'%'},{passive:true});const l=[...document.querySelectorAll('.toc a')];if(l.length&&'IntersectionObserver'in window){const io=new IntersectionObserver(e=>e.forEach(x=>{if(x.isIntersecting){l.forEach(k=>k.classList.toggle('on',k.hash==='#'+x.target.id))}}),{rootMargin:'-20% 0px -70% 0px'});document.querySelectorAll('.prose h2[id]').forEach(h=>io.observe(h))}const c=document.querySelector('[data-copy]');c&&c.addEventListener('click',()=>{navigator.clipboard&&navigator.clipboard.writeText(location.href).then(()=>{c.textContent='¡Enlace copiado!'})})})()</script>`;
for (const p of posts) {
  const t = topicOf(p.topic);
  const same = posts.filter((x) => x.slug !== p.slug && x.topic === p.topic);
  const related = [...same, ...posts.filter((x) => x.slug !== p.slug && x.topic !== p.topic)].slice(0, 3);
  const url = `${SITE}/blog/${p.slug}/`;
  const heads = toc(p.content);
  const enc = encodeURIComponent;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.seo_description || p.excerpt, datePublished: p.published_at, dateModified: p.updated_at || p.published_at, mainEntityOfPage: url, image: p.cover_url || undefined, inLanguage: 'es-ES', wordCount: String(p.content).split(/\s+/).length, author: { '@type': 'Organization', name: 'LOOSES & WINS', url: SITE }, publisher: { '@type': 'Organization', name: 'LOOSES & WINS', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/icon-192.png` } }, articleSection: t.label, keywords: (p.tags || []).join(', ') },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Blog', item: `${SITE}/blog/` }, { '@type': 'ListItem', position: 2, name: t.label, item: `${SITE}/blog/tema/${t.slug}/` }, { '@type': 'ListItem', position: 3, name: p.title, item: url }] },
  ];
  out(`blog/${p.slug}/index.html`, head({ title: `${p.title} | LOOSES & WINS`, description: p.seo_description || p.excerpt, url, image: p.cover_url, type: 'article', jsonld })
    + `<div class="progress"></div>
<header class="ahead narrow"><div class="crumbs"><a href="/blog/">Blog</a> / <a href="/blog/tema/${t.slug}/">${esc(t.label)}</a></div>${badge(p.topic)}
<h1>${esc(p.title)}</h1>${p.excerpt ? `<p class="dek">${esc(p.excerpt)}</p>` : ''}${byline(p, true)}</header>
${p.cover_url ? `<figure class="acover"><img src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || p.title)}" fetchpriority="high">${p.cover_credit ? `<figcaption class="credit">${esc(p.cover_credit)}</figcaption>` : ''}</figure>` : ''}
<main class="article"><article>
<div class="prose">${article(p.content)}</div>
${(p.tags || []).length ? `<div class="tags">${p.tags.map((x) => `<span>#${esc(x)}</span>`).join('')}</div>` : ''}
<div class="share"><span>Compartir:</span><a href="https://wa.me/?text=${enc(`${p.title} ${url}`)}" target="_blank" rel="noopener">WhatsApp</a><a href="https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}" target="_blank" rel="noopener">LinkedIn</a><a href="https://x.com/intent/post?url=${enc(url)}&amp;text=${enc(p.title)}" target="_blank" rel="noopener">X</a><button type="button" data-copy>Copiar enlace</button></div>
<div class="endcta"><div><h3>¿Cuánto ganas de verdad con cada pedido?</h3><p>LOOSES &amp; WINS une Shopify, tus costes, tus anuncios y tus facturas y te enseña el beneficio real. Empieza gratis, sin tarjeta.</p></div><a class="btn btn-primary" href="${APP}/signup/?plan=free">Empieza gratis</a></div>
${(p.sources || []).length ? `<section class="sources"><h2>Fuentes</h2><ul>${p.sources.map((s) => `<li><a href="${esc(s.url)}" rel="nofollow noopener" target="_blank">${esc(s.title)}</a></li>`).join('')}</ul></section>` : ''}
</article>
<aside class="side">${heads.length > 1 ? `<nav class="toc"><h4>En este artículo</h4><ol>${heads.map((h) => `<li><a href="#${slugId(h)}">${esc(h)}</a></li>`).join('')}</ol></nav>` : ''}
<div class="cta"><h3>Tu beneficio real, pedido a pedido</h3><ul><li>Shopify, AliExpress y agentes</li><li>Meta, Google y TikTok Ads</li><li>IVA, OSS y cierre de mes</li></ul><a class="btn btn-primary" href="${APP}/signup/?plan=free">Empieza gratis</a><a class="btn btn-ghost" href="/#precios">Ver planes</a></div>
</aside></main>
${related.length ? `<section class="related wrap"><h2>Sigue leyendo</h2><div class="grid">${related.map((r) => card(r)).join('')}</div></section>` : ''}
${PAGE_JS}<script>try{fetch(${JSON.stringify(API)},{method:'POST',body:JSON.stringify({action:'blog_view',slug:${JSON.stringify(p.slug)}}),keepalive:true})}catch(e){}</script>${foot()}`);
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
