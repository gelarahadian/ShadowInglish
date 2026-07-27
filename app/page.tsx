import Navbar from "@/components/shared/Navbar";
import Hero from "@/components/shared/Hero";
import Features from "@/components/shared/Features";
import Cta from "@/components/shared/Cta";
import Footer from "@/components/shared/Footer";

export default function Home() {
  return (
    <div className="bg-white dark:bg-black">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
