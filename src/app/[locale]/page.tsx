import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/button";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-6 max-w-xl">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {dict.home.title}
        </h1>
        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400">
          {dict.home.description}
        </p>
        <Button size="lg">{dict.home.cta}</Button>
      </div>
    </main>
  );
}
