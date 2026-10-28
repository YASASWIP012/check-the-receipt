import { Checker } from "@/components/Checker";
import featured from "@/data/featured-receipt.json";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/YASASWIP012/check-the-receipt";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const id = typeof params.id === "string" && UUID_RE.test(params.id) ? params.id.toLowerCase() : featured.data_id;
  const lang = params.lang === "ko" ? "ko" : "en";
  return <Checker key={id} initialId={id} initialLang={lang} repoUrl={REPO_URL} />;
}
