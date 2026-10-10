import { SITE_NAME } from "@/lib/site";

// React hoists <title> into <head> and swaps it as screens mount, which keeps
// the tab right for the client-rendered screens behind AuthGate (sign in and
// the library share "/"). The root layout sets no title so nothing competes.
export default function PageTitle({ name }: { name?: string }) {
  const pageName = name?.trim();
  return <title>{pageName ? `${pageName} | ${SITE_NAME}` : SITE_NAME}</title>;
}
