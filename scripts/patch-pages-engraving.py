from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: patch-pages-engraving.py <stamp-rally.html>")

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

text = text.replace(
    "  let engravingVisualTexture=null;\n  let engravingBumpTexture=null;",
    "  let engravingVisualTexture=null;\n  let engravingBumpTexture=null;\n  let engravingOverlayGeometry=null;\n  let engravingOverlayMaterial=null;",
    1,
)

pattern = re.compile(
    r'  const engravingText=\(engravingLines\|\|\[\]\)\.map\(x=>String\(x\|\|""\)\.trim\(\)\)\.filter\(Boolean\)\.slice\(0,4\);\n'
    r'  if\(engravingText\.length\)\{.*?\n  \}\n\n  const gltf=',
    re.S,
)
replacement = '''  const engravingText=(engravingLines||[]).map(x=>String(x||"").trim()).filter(Boolean).slice(0,4);
  if(engravingText.length){
   const visualCanvas=document.createElement("canvas");visualCanvas.width=1024;visualCanvas.height=1024;
   const bumpCanvas=document.createElement("canvas");bumpCanvas.width=1024;bumpCanvas.height=1024;
   const visualCtx=visualCanvas.getContext("2d");
   const bumpCtx=bumpCanvas.getContext("2d");
   if(visualCtx&&bumpCtx){
    visualCtx.clearRect(0,0,1024,1024);
    visualCtx.textAlign="center";visualCtx.textBaseline="middle";
    bumpCtx.fillStyle="#000";bumpCtx.fillRect(0,0,1024,1024);
    bumpCtx.fillStyle="#fff";bumpCtx.textAlign="center";bumpCtx.textBaseline="middle";
    const ys=[520,610,700,790],sizes=[68,56,52,50],weights=[650,620,540,500];
    engravingText.forEach((line,index)=>{
     let size=sizes[index]||50,weight=weights[index]||500;
     do{
      const font=weight+" "+size+'px Arial, "Helvetica Neue", sans-serif';
      visualCtx.font=font;bumpCtx.font=font;
      if(visualCtx.measureText(line).width<=650)break;
      size-=2;
     }while(size>30);
     const y=ys[index]||790;
     visualCtx.fillStyle="rgba(255,255,255,0.30)";
     visualCtx.fillText(line,512,y-2);
     visualCtx.fillStyle="rgba(66,66,66,0.72)";
     visualCtx.fillText(line,512,y+1);
     bumpCtx.fillText(line,512,y);
    });
    engravingVisualTexture=new THREE.CanvasTexture(visualCanvas);
    engravingVisualTexture.colorSpace=THREE.SRGBColorSpace;
    engravingVisualTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    engravingBumpTexture=new THREE.CanvasTexture(bumpCanvas);
    engravingBumpTexture.colorSpace=THREE.NoColorSpace;
    engravingBumpTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    backMaterial.bumpMap=engravingBumpTexture;
    backMaterial.bumpScale=-.016;
    backMaterial.needsUpdate=true;
   }
  }

  const gltf='''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f"engraving block replacement count={count}")

anchor = '''   else if(object.name==="brushed_detail")object.material=brushedMaterial;
   else if(object.name==="pin_assembly")object.material=pinMaterial;
  });

  let faceTexture=null;'''
overlay = '''   else if(object.name==="brushed_detail")object.material=brushedMaterial;
   else if(object.name==="pin_assembly")object.material=pinMaterial;
  });

  const backShell=medal.getObjectByName("back_shell");
  if(engravingVisualTexture&&backShell instanceof THREE.Mesh){
   backShell.geometry.computeBoundingBox();
   const bounds=backShell.geometry.boundingBox;
   if(bounds){
    const shellSize=bounds.getSize(new THREE.Vector3());
    const shellCenter=bounds.getCenter(new THREE.Vector3());
    engravingOverlayGeometry=new THREE.PlaneGeometry(shellSize.x*.84,shellSize.y*.84);
    engravingOverlayMaterial=new THREE.MeshBasicMaterial({
     map:engravingVisualTexture,
     transparent:true,
     alphaTest:.02,
     depthTest:false,
     depthWrite:false,
     side:THREE.FrontSide,
     toneMapped:false
    });
    const overlay=new THREE.Mesh(engravingOverlayGeometry,engravingOverlayMaterial);
    overlay.name="engraving_overlay";
    overlay.position.set(shellCenter.x,shellCenter.y-shellSize.y*.035,bounds.max.z+Math.max(shellSize.z*.04,.35));
    overlay.renderOrder=1000;
    backShell.add(overlay);
   }
  }

  let faceTexture=null;'''
if anchor not in text:
    raise SystemExit("overlay insertion anchor not found")
text = text.replace(anchor, overlay, 1)

cleanup = '''   faceTexture?.dispose();
   engravingVisualTexture?.dispose();
   engravingBumpTexture?.dispose();'''
cleanup_new = '''   faceTexture?.dispose();
   engravingOverlayGeometry?.dispose();
   engravingOverlayMaterial?.dispose();
   engravingVisualTexture?.dispose();
   engravingBumpTexture?.dispose();'''
if cleanup not in text:
    raise SystemExit("cleanup anchor not found")
text = text.replace(cleanup, cleanup_new, 1)

path.write_text(text, encoding="utf-8")
print(f"patched {path}")
