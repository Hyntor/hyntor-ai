import { HealthStatus } from "./health-status";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Hyntor</h1>
      <p className="mt-2 text-slate-600">Placeholder home page. Features land here as the backlog moves.</p>
      <HealthStatus />
    </main>
  );
}
