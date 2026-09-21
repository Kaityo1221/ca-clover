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

export async function createCommunityIconThumbnail(
  admin:StorageAdminClient,
  communityId:string,
  source:ArrayBuffer,
){
  await ensureImageMagick();

  const result=ImageMagick.read(new Uint8Array(source),(image):Uint8Array=>{
    image.resize(256,256);
    return image.write(MagickFormat.WebP,(data)=>data);
  });

  const path=communityId+".webp";
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
