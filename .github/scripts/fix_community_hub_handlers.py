from pathlib import Path

p=Path('docs/index.html')
s=p.read_text()

bad='''        document.getElementById("backMy").onclick=function(){\n      if(communityFeatureView==="home"){go("my");return}\n      communityFeatureView="home";\n      void renderCommunity(id);\n    };\n    app.querySelectorAll("[data-community-feature]").forEach(function(b){\n      b.onclick=function(){communityFeatureView=b.dataset.communityFeature||"home";void renderCommunity(id)};\n    });\n        return;\n'''
good='''        document.getElementById("backMy").onclick=function(){go("my")};\n        return;\n'''
assert bad in s, 'misplaced handler block not found'
s=s.replace(bad,good,1)

old='''    app.innerHTML=html;\n    document.getElementById("backMy").onclick=function(){go("my")};\n    app.querySelectorAll("[data-community-period]").forEach(function(b){\n'''
new='''    app.innerHTML=html;\n    document.getElementById("backMy").onclick=function(){\n      if(communityFeatureView==="home"){go("my");return}\n      communityFeatureView="home";\n      void renderCommunity(id);\n    };\n    app.querySelectorAll("[data-community-feature]").forEach(function(b){\n      b.onclick=function(){communityFeatureView=b.dataset.communityFeature||"home";void renderCommunity(id)};\n    });\n    app.querySelectorAll("[data-community-period]").forEach(function(b){\n'''
assert old in s, 'main handler anchor not found'
s=s.replace(old,new,1)

s=s.replace('const VERSION="my-community-20260927-community-hub1";', 'const VERSION="my-community-20260927-community-hub2";',1)
p.write_text(s)
