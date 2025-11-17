import { OpenSignalsChart } from "@/components/OpenSignalsChart";

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <main className="w-full max-w-7xl mx-auto flex flex-col py-8 px-4 sm:px-8 bg-white">
        <OpenSignalsChart />
      </main>
    </div>
  );
}
