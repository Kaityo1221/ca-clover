import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.30";

type StorageAdminClient={
  storage:{
    from:(bucket:string)=>any;
  };
};

let initialization:Promise<void>|null=null;

async function ensureImageMagick(){
  if(!initialization){
    initialization=(async()=>{
      const wasmBytes=await Deno.readFile(
        new URL(
          "magick.wasm",
          import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.30"),
        ),
      );
      await initializeImageMagick(wasmBytes);
    })();
  }
  await initialization;
}

function sourceDimensions(source:ArrayBuffer){
  const bytes=new Uint8Array(source);
  const png=[137,80,78,71,13,10,26,10];
  if(bytes.byteLength>=24&&png.every((value,index)=>bytes[index]===value)){
    const view=new DataView(source);
    return {width:view.getUint32(16),height:view.getUint32(20)};
  }

  if(bytes.byteLength>=4&&bytes[0]===0xff&&bytes[1]===0xd8){
    let offset=2;
    while(offset+9<bytes.length){
      if(bytes[offset]!==0xff){offset++;continue}
      while(offset<bytes.length&&bytes[offset]===0xff)offset++;
      const segment=bytes[offset++];
      if(segment===0xd8||segment===0xd9)continue;
      if(segment===0xda)break;
      if(offset+1>=bytes.length)break;
      const length=(bytes[offset]<<8)|bytes[offset+1];
      if(length<2||offset+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(segment)){
        return {
          height:(bytes[offset+3]<<8)|bytes[offset+4],
          width:(bytes[offset+5]<<8)|bytes[offset+6],
        };
      }
      offset+=length;
    }
  }
  return null;
}

async function renderThumbnail(source:ArrayBuffer){
  const dimensions=sourceDimensions(source);
  if(dimensions&&(
    dimensions.width>4096
    ||dimensions.height>4096
    ||dimensions.width*dimensions.height>8_000_000
  )){
    throw new Error("source_dimensions_too_large");
  }

  await ensureImageMagick();
  return ImageMagick.read(new Uint8Array(source),(image):Uint8Array=>{
    image.resize(256,256);
    return image.write(MagickFormat.WebP,(data)=>new Uint8Array(data));
  });
}

async function uploadThumbnail(
  admin:StorageAdminClient,
  path:string,
  source:ArrayBuffer,
){
  const result=await renderThumbnail(source);
  const {error}=await admin.storage
    .from("community-icon-thumbs")
    .upload(path,result,{
      contentType:"image/webp",
      cacheControl:"31536000",
      upsert:true,
    });
  if(error) throw error;
  return path;
}

export async function createCommunityIconThumbnail(
  admin:StorageAdminClient,
  communityId:string,
  source:ArrayBuffer,
){
  return uploadThumbnail(admin,communityId+".webp",source);
}

export async function createCommunityIconVersionThumbnail(
  admin:StorageAdminClient,
  communityId:string,
  contentHash:string,
  source:ArrayBuffer,
){
  return uploadThumbnail(admin,"versions/"+communityId+"/"+contentHash+".webp",source);
}
