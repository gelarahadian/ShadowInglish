import Hero from "@/components/shared/Hero";
import Features from "@/components/shared/Features";
import Cta from "@/components/shared/Cta";

export default function Home() {
  return (
    <div className="bg-white">
            <main>
        <Hero />
        <Features />
        <Cta />
      </main>
    </div>
  );
}
