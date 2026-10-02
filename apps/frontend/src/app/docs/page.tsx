import { redirect } from "next/navigation";

export default function DocsRedirectPage() {
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.srevox.in";
  redirect(docsUrl);
}
