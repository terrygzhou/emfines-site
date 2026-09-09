import json, html, pathlib

opts = [
 dict(id="opt-1", num="01", file="01-classic-luxe.html",  name="Classic Luxury",
      aesthetic="Heritage house-jewel: ivory canvas, deep-blue accent, serif display, quiet luxury",
      inspired="Tiffany & Co. AU — Blue Book campaigns, “Icons” merchandising, gifting services",
      palette=["#ffffff","#0e1a2b","#1e4d8c","#5a6572"]),
 dict(id="opt-2", num="02", file="02-editorial-soft.html", name="Editorial Soft",
      aesthetic="Warm boutique: soft neutrals, story-driven keepsake framing, rounded imagery",
      inspired="by charlotte (“Your Lotus Story”, Bridal Journey) · Sarah & Sebastian (warm grey canvas)",
      palette=["#f6f2ee","#2e2c2a","#8a6d5c","#fbdfdf"]),
 dict(id="opt-3", num="03", file="03-dark-gem.html",      name="Dark Gemstone",
      aesthetic="Gemstone-led dark mode: near-black canvas, gold accent, sale urgency + advisory content",
      inspired="Michael Hill AU — #0d0d0f palette, “30% off selected”, advisor & finance blocks",
      palette=["#0d0d0f","#f5f2ec","#c8a24b","#1c1b1f"]),
 dict(id="opt-4", num="04", file="04-minimal-canvas.html", name="Minimal Canvas",
      aesthetic="Bright catalogue: white canvas, pink pops, pill buttons, promotional energy",
      inspired="Pandora AU — sale-forward homepage, promo code banner, collabs, best-sellers",
      palette=["#ffffff","#111111","#e0489a","#ffd9ea"]),
 dict(id="opt-5", num="05", file="05-avant-garde.html",   name="Avant-Garde Crystal",
      aesthetic="Fashion-forward: monochrome + signature red, oversized uppercase type, full-bleed cinematic media",
      inspired="Swarovski AU + EVRYJEWELS — campaign-driven, bold type, statement scale",
      palette=["#ffffff","#0a0a0a","#c1121f","#3a3a3a"]),
]

for o in opts:
    raw = pathlib.Path(o["file"]).read_bytes()
    o["srcdoc"] = html.escape(raw.decode("utf-8"), quote=True)

cards = "\n".join(f'''
<article class="card" id="{o['id']}" data-num="{o['num']}">
  <div class="card-top"><span class="num">{o['num']}</span><span class="swatches">{''.join(f'<i style="background:{c}" title="{c}"></i>' for c in o["palette"])}</span></div>
  <h3>Option {o['num'][-1]} — {o['name']}</h3>
  <p class="aesthetic">{o['aesthetic']}</p>
  <p class="inspired">{o['inspired']}</p>
  <a class="jump" href="#{o['id']}">View preview ↓</a>
</article>''' for o in opts)

sections = "\n".join(f'''
<section class="option" id="preview-{o['id']}">
  <div class="opt-head">
    <div><span class="opt-num">{o['num']}</span><h2>{o['name']}</h2></div>
    <p class="opt-sub">{o['aesthetic']}</p>
  </div>
  <iframe srcdoc="{o['srcdoc']}" title="Option {o['num'][-1]} — {o['name']} preview" loading="lazy"></iframe>
  <div class="opt-actions">
    <button class="select-btn" data-num="{o['num']}">Select this direction</button>
    <a class="open" href="{o['file']}" target="_blank">Open sample file ↗</a>
    <span class="hint">Scroll inside the preview — it is the full, responsive sample</span>
  </div>
</section>''' for o in opts)

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EMF-11 — Design Direction Selection</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
:root{{--bg:#faf9f7;--ink:#1c1b18;--muted:#6f6a61;--line:#e5e1da;--accent:#a68a5b;--card:#fff}}
body{{font-family:"Helvetica Neue",Inter,Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased}}
h1,h2,h3{{font-family:Georgia,"Times New Roman",serif;font-weight:600;line-height:1.2}}
a{{color:var(--accent)}}
.container{{max-width:1240px;margin:0 auto;padding:0 24px}}
/* top bar */
.top{{position:sticky;top:0;z-index:50;background:var(--bg);border-bottom:1px solid var(--line)}}
.top .container{{display:flex;align-items:center;gap:20px;height:56px}}
.top .mark{{font-family:Georgia,serif;font-size:15px;letter-spacing:.12em;text-transform:uppercase}}
.tabs{{display:flex;gap:6px;overflow-x:auto}}
.tabs a{{font-size:13px;color:var(--muted);padding:6px 12px;border-radius:999px;white-space:nowrap;text-decoration:none}}
.tabs a.active{{background:var(--ink);color:#fff}}
/* intro */
.intro{{padding:72px 0 48px;max-width:760px}}
.eyebrow{{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}}
.intro h1{{font-size:clamp(30px,4vw,46px);margin-bottom:16px}}
.intro p{{color:var(--muted);font-size:16px;margin-bottom:10px}}
/* overview cards */
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;padding-bottom:48px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;display:flex;flex-direction:column;gap:10px;position:relative}}
.card.selected{{border:2px solid var(--accent)}}
.card-top{{display:flex;justify-content:space-between;align-items:center}}
.num{{font-family:Georgia,serif;font-size:28px;color:var(--accent)}}
.swatches i{{display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid #00000014;margin-left:3px}}
.card h3{{font-size:19px}}
.aesthetic{{font-size:13.5px;color:var(--ink)}}
.inspired{{font-size:12px;color:var(--muted)}}
.jump{{margin-top:auto;font-size:13px;text-decoration:none;font-weight:600}}
/* option preview sections */
.option{{padding:56px 0;border-top:1px solid var(--line)}}
.opt-head{{display:flex;align-items:baseline;justify-content:space-between;gap:24px;margin-bottom:20px;flex-wrap:wrap}}
.opt-num{{font-family:Georgia,serif;font-size:15px;color:var(--accent);letter-spacing:.14em;margin-right:10px}}
.opt-head h2{{display:inline;font-size:30px}}
.opt-sub{{color:var(--muted);font-size:14px;max-width:520px}}
iframe{{width:100%;height:82vh;min-height:620px;border:1px solid var(--line);border-radius:16px;background:#fff}}
.opt-actions{{display:flex;align-items:center;gap:16px;margin-top:18px;flex-wrap:wrap}}
.select-btn{{cursor:pointer;border:none;background:var(--ink);color:#fff;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600}}
.select-btn.selected{{background:var(--accent)}}
.open{{font-size:14px;font-weight:600}}
.hint{{font-size:12.5px;color:var(--muted)}}
/* selection bar */
#sel-bar{{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(140%);z-index:60;background:var(--ink);color:#fff;border-radius:999px;padding:10px 12px 10px 22px;display:flex;align-items:center;gap:14px;font-size:14px;box-shadow:0 12px 32px #00000030;transition:transform .3s ease;max-width:92vw}}
#sel-bar.show{{transform:translateX(-50%) translateY(0)}}
#sel-bar button{{cursor:pointer;border:none;background:#ffffff22;color:#fff;border-radius:999px;padding:7px 14px;font-size:12.5px;font-weight:600}}
footer{{padding:56px 0 88px;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}}
@media(max-width:700px){{.opt-head{{flex-direction:column;align-items:flex-start}}iframe{{height:70vh;min-height:480px}}}}
</style>
</head>
<body>
<div class="top"><div class="container">
  <span class="mark">EMF-11</span>
  <nav class="tabs">{''.join(f'<a href="#preview-{o['id']}" data-tab="{o['num']}">{o['num']} · {o['name']}</a>' for o in opts)}<a href="#top" data-tab="">Overview</a></nav>
</div></div>

<div id="top" class="container">
  <div class="intro">
    <div class="eyebrow">Design research · Five directions</div>
    <h1>Choose the direction for the new emfines site</h1>
    <p>Five design explorations, each built from research across seven jewellery brands (Michael Hill, Tiffany &amp; Co., Pandora, Sarah &amp; Sebastian, by charlotte, EVRYJEWELS, Swarovski).</p>
    <p>Each preview below is the full responsive sample — scroll inside any frame to explore it top to bottom. Select the direction that feels right, or mix-and-match in the conversation; a canonical theme will be built from the chosen direction.</p>
  </div>

  <div class="grid">{cards}
  </div>
</div>

{sections}

<footer><div class="container">
  <p>Every option shares the same underlying structure (hero, merchandised collections, feature stories, trust/service blocks, footer) so the comparison is about <em>feel</em> — palette, type, tone and pace — not layout. Selecting one direction (or a blend) lets us build the canonical design system: tokens, components, then pages.</p>
</div></footer>

<div id="sel-bar"><span id="sel-text"></span><button id="sel-copy">Copy selection</button><button id="sel-clear">Clear</button></div>

<script>
const opts = {json.dumps([{"num":o["num"],"name":o["name"]} for o in opts])};
const KEY = "emf11-selection";
const bar = document.getElementById("sel-bar"), selText = document.getElementById("sel-text");

function setSel(num, save=true){{
  document.querySelectorAll(".card,.select-btn").forEach(el=>el.classList.remove("selected"));
  if(num){{
    document.querySelectorAll(`[data-num="${{num}}"]`).forEach(el=>el.classList.add("selected"));
    const o = opts.find(o=>o.num===num);
    selText.textContent = "Selected direction: " + o.num + " — " + o.name;
    bar.classList.add("show");
  }} else bar.classList.remove("show");
  if(save) localStorage.setItem(KEY, num || "");
}}
document.querySelectorAll(".select-btn").forEach(b=>b.addEventListener("click",()=>setSel(b.dataset.num)));
document.getElementById("sel-clear").addEventListener("click",()=>setSel(null));
document.getElementById("sel-copy").addEventListener("click",async()=>{{
  const v = localStorage.getItem(KEY)||"";
  const o = opts.find(o=>o.num===v);
  try{{ await navigator.clipboard.writeText(o?"Selected design direction: "+o.num+" — "+o.name:""); selText.textContent="Copied to clipboard ✓"; setTimeout(()=>bar.classList.add("show"),0); }}catch(e){{ selText.textContent="Selected: "+(o?o.num+" — "+o.name:"—"); }}
}});

// restore
setSel(localStorage.getItem(KEY)||null, false);

// sticky tab highlighting
const links = [...document.querySelectorAll(".tabs a[data-tab]")];
const map = {{}}; links.forEach(l=>map[l.dataset.tab]=l);
const io = new IntersectionObserver(entries=>{{
  entries.forEach(e=>{{ if(e.isIntersecting){{ links.forEach(l=>l.classList.remove("active")); (map[e.target.dataset.num]||links[links.length-1]).classList.add("active"); }} }});
}},{{rootMargin:"-20% 0px -70% 0px"}});
document.querySelectorAll(".option").forEach(s=>io.observe(s));
</script>
</body>
</html>'''

out = pathlib.Path(__file__).parent / "compare.html"
out.write_text(html, encoding="utf-8")
print("compare.html written:", len(html), "chars")
