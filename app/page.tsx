import { OpenSignalsChart } from "@/components/OpenSignalsChart";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-7xl mx-auto flex flex-col py-8 px-4 sm:px-8 bg-white dark:bg-black">
        <OpenSignalsChart />
      </main>
    </div>
  );
}
