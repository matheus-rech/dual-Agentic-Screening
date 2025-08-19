import Header from "@/components/Header";
import DemoCard from "@/components/DemoCard";
import ImportSection from "@/components/ImportSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          <DemoCard />
          <ImportSection />
        </div>
      </main>
    </div>
  );
};

export default Index;
