import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import "@/components/landing/landing.css";
import { SketchyFilter } from "@/components/landing/SketchyFilter";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Testimonials } from "@/components/landing/Testimonials";
import { DownloadCTA } from "@/components/landing/DownloadCTA";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { WavyDivider } from "@/components/landing/WavyDivider";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="lungnote-landing flex-1">
      <SketchyFilter />
      <Nav />
      <Hero />
      <WavyDivider />
      <Features />
      <WavyDivider />
      <HowItWorks />
      <WavyDivider />
      <Testimonials />
      <WavyDivider />
      <DownloadCTA />
      <WavyDivider />
      <Faq />
      <Footer />
    </div>
  );
}
