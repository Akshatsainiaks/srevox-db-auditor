import { redirect } from "next/navigation";

export default function DocsRedirectPage() {
  const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL || "https://srevox-website.vercel.app";
  redirect(`${websiteUrl}/docs`);
}
