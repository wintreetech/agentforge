"""Build product-specific WebP compositions from original category artwork and catalog data.
Requires Pillow; run from any directory. Existing SVG diagrams remain vector assets.
"""
from pathlib import Path
import re, json, textwrap
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
PUBLIC=ROOT/'apps/web/public'
SOURCE=ROOT/'scripts/artwork/category-art.webp'
ART=Image.open(SOURCE).convert('RGB')
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
CATS={'T':(0,'AI MICRO TOOLS','#b7a4ff'),'W':(1,'AUTOMATION WORKFLOWS','#70dff8'),'A':(2,'AI AGENTS','#70e8d7'),'M':(3,'MULTI-AGENT SYSTEMS','#a7a2ff'),'B':(4,'BUSINESS SOLUTIONS','#ffc47c'),'D':(5,'DEVELOPER KITS','#65e6b5')}
def font(n,b=False): return ImageFont.truetype(BOLD if b else FONT,n)
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
def wrap(s,f,w,d):
    lines=[]; line=''
    for word in s.split():
        test=(line+' '+word).strip()
        if line and d.textlength(test,font=f)>w: lines.append(line); line=word
        else: line=test
    if line: lines.append(line)
    return lines
raw=(ROOT/'packages/catalog/src/raw-products.ts').read_text()
products=re.findall(r'title: "([^"]+)", price: \d+, category: ([TWAMBD]), sub: "([^"]+)"',raw)
manifest_path=PUBLIC/'assets/manifest.json'; manifest=json.loads(manifest_path.read_text()); entries=[a for a in manifest['assets'] if not a['path'].endswith('/cover.webp')]
for title,cat,sub in products:
    if cat=='M': continue
    idx,label,accent=CATS[cat]; x=idx%3*ART.width//3; y=idx//3*ART.height//2
    tile=ART.crop((x+3,y+3,x+ART.width//3-3,y+ART.height//2-3)).resize((530,530),Image.Resampling.LANCZOS)
    canvas=Image.new('RGB',(900,600),'#090f23'); canvas.paste(tile,(370,35));
    # Soft blend left into illustration, retaining clean text contrast.
    overlay=Image.new('RGBA',canvas.size); od=ImageDraw.Draw(overlay)
    for xx in range(510):
        a=255 if xx<350 else int(255*(510-xx)/160)
        od.line((xx,0,xx,600),fill=(9,15,35,a))
    canvas=Image.alpha_composite(canvas.convert('RGBA'),overlay).convert('RGB'); d=ImageDraw.Draw(canvas)
    d.rounded_rectangle((42,40,858,560),radius=25,outline='#263554',width=2)
    d.rounded_rectangle((66,78,112,84),radius=3,fill=accent)
    d.text((66,100),label,font=font(16,True),fill=accent)
    f=font(42,True); lines=wrap(title,f,340,d)
    while len(lines)>4:
        f=font(f.size-2,True); lines=wrap(title,f,340,d)
    yy=172
    for line in lines: d.text((66,yy),line,font=f,fill='#f2f5ff'); yy+=f.size+9
    d.text((66,yy+24),sub,font=font(22),fill='#a9bbd9')
    d.text((66,509),'AGENTFORGE AI',font=font(17,True),fill='#9aaaca')
    target=PUBLIC/'assets/products'/slug(title)/'cover.webp'; target.parent.mkdir(parents=True,exist_ok=True)
    canvas.save(target,'WEBP',quality=78,method=6)
    entries.append({'path':'/'+str(target.relative_to(PUBLIC)),'type':'webp-illustration','source':'AI-generated category illustration with catalog-specific typography; composed by scripts/optimize-product-images.py','generation':{'category':label,'product':title,'dimensions':[900,600]}})
for p in (PUBLIC/'screenshots').rglob('*.png'):
    im=Image.open(p).convert('RGB'); im.save(p.with_suffix('.webp'),'WEBP',quality=88,method=6)
manifest['assets']=entries; manifest['count']=len(entries); manifest['notes']='Original SVG diagrams and AI-generated category artwork composed into product-specific WebP covers. Screenshots are genuine captures, not generated product UI.'
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print('Active covers:',sum(cat!='M' for _,cat,_ in products))
