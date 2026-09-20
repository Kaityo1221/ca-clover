import {redirect} from "next/navigation";

export default async function Page({
  params,
}:{
  params:Promise<{meetupId:string}>;
}){
  const {meetupId}=await params;
  redirect("/admin/meetup-watch#meetup-"+encodeURIComponent(meetupId));
}
