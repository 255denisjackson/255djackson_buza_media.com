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
