// Pure helpers: read an RSS/Atom feed (including Bing News feeds) into plain story objects.
// (no external libraries: a small reader that handles RSS 2.0, RDF and Atom, including Bing News feeds)

export type Story = { title: string; link: string; text: string; image: string; published: string; source: string };

export function decodeEntities(s: string): string {
  return String(s ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => safeChr(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => safeChr(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function safeChr(n: number): string { return n >= 32 && n <= 1114111 ? String.fromCodePoint(n) : ""; }
export function stripHtml(s: string): string {
  return decodeEntities(String(s ?? "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]*>/g, " "))
    .replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
const esc = (n: string) => n.replace(/[.*+?^${}()|[\]\\:]/g, "\\$&");
const unCdata = (v: string) => v.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${esc(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${esc(name)}>`, "i"));
  if (!m) return "";
  // plain text is XML-escaped (decode once); CDATA content is already raw
  return (/^\s*<!\[CDATA\[/.test(m[1]) ? unCdata(m[1]) : decodeEntities(m[1])).trim();
}
function attr(block: string, name: string, a: string): string {
  const m = block.match(new RegExp(`<${esc(name)}\\s[^>]*?\\b${esc(a)}\\s*=\\s*["']([^"']+)["']`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

export function unwrapLink(link: string): string {
  try {
    const u = new URL(link);
    if (/(^|\.)bing\.com$/.test(u.hostname)) { const t = u.searchParams.get("url"); if (t && /^https?:\/\//i.test(t)) return t; }
    return link;
  } catch { return link; }
}
export function normalizeLink(link: string): string {
  try {
    const u = new URL(link); u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ocid|cid$)/i.test(k)) u.searchParams.delete(k);
    return (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "") + (u.search || "")).toLowerCase();
  } catch { return link.toLowerCase(); }
}

export function parseFeed(xml: string): Story[] {
  const out: Story[] = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  for (const it of blocks) {
    let link = tag(it, "link").trim();
    if (!link) { // Atom: <link rel="alternate" href="..."/>
      const links = it.match(/<link\s[^>]*>/gi) || [];
      const pick = links.find((l) => !/rel=/i.test(l) || /rel=["']alternate["']/i.test(l)) || links[0] || "";
      const h = pick.match(/href=["']([^"']+)["']/i); link = h ? decodeEntities(h[1]) : "";
    }
    if (!link && /^https?:\/\//.test(tag(it, "guid"))) link = tag(it, "guid");
    link = unwrapLink(link.trim());
    const rawDesc = tag(it, "content:encoded") || tag(it, "description") || tag(it, "summary") || tag(it, "content");
    let image = attr(it, "media:content", "url") || attr(it, "media:thumbnail", "url")
      || (/<enclosure\s[^>]*type=["']image\//i.test(it) || !/<enclosure\s[^>]*type=/i.test(it) ? attr(it, "enclosure", "url") : "")
      || tag(it, "News:Image");
    if (!image) { const m = decodeEntities(rawDesc).match(/<img[^>]+src=["']([^"']+)["']/i) || rawDesc.match(/<img[^>]+src=["']([^"']+)["']/i); if (m) image = decodeEntities(m[1]); }
    if (image.startsWith("//")) image = "https:" + image;
    const source = stripHtml(tag(it, "News:Source") || tag(it, "source"));
    let title = stripHtml(tag(it, "title"));
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3)).trim();
    if (!title || !/^https?:\/\//i.test(link)) continue;
    out.push({ title, link, text: stripHtml(rawDesc), image: /^https?:\/\//i.test(image) ? image : "", published: tag(it, "pubDate") || tag(it, "published") || tag(it, "updated") || tag(it, "dc:date"), source });
  }
  return out;
}

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h === "::1" || (h.includes(":") && (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")))) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

// Publisher's full-size picture: <meta property="og:image"> (or twitter:image) from the story page.
export function ogImage(html: string, base: string): string {
  const head = html.slice(0, 300_000);
  const metas = head.match(/<meta\s[^>]*>/gi) || [];
  for (const m of metas) {
    if (!/(?:property|name)\s*=\s*["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["']/i.test(m)) continue;
    const c = m.match(/content\s*=\s*["']([^"']+)["']/i);
    if (!c) continue;
    try { const u = new URL(decodeEntities(c[1]).trim(), base); if (/^https?:$/.test(u.protocol)) return u.href; } catch { /* next */ }
  }
  return "";
}

// Width/height of a PNG, JPEG, GIF or WebP from its first bytes.
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const u16 = (o: number) => (b[o] << 8) | b[o + 1], l16 = (o: number) => b[o] | (b[o + 1] << 8);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { width: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, height: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0 };
  if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { width: l16(6), height: l16(8) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const mk = b[o + 1];
      if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7) || mk === 0xff) { o += mk === 0xff ? 1 : 2; continue; }
      const len = u16(o + 2);
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { height: u16(o + 5), width: u16(o + 7) };
      o += 2 + len;
    }
    return null;
  }
  if (b.length > 30 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === "VP8 ") return { width: l16(26) & 0x3fff, height: l16(28) & 0x3fff };
    if (kind === "VP8L") { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
    if (kind === "VP8X") return { width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1, height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1 };
  }
  return null;
}
