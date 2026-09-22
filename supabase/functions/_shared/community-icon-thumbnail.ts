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

async function renderThumbnail(source:ArrayBuffer){
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
