import re
src = open('/tmp/gp-index.js', encoding='utf8', errors='replace').read()
for pat in ['swf/${e}', 'swf/${r}', 'swf/${i.package}', 'swf/${gd', 'swf/${ud', 'swf/${si']:
    for m in re.finditer(re.escape(pat), src):
        print('>>>', pat, '@', m.start())
        print(src[max(0, m.start()-500):m.start()+500])
        print('======')
        break
