import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/command-center/app";
import { getSnapshot } from "@/lib/voltcore/server-fns";

export const Route = createFileRoute("/")({
  loader: () => getSnapshot(),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <CommandCenter initial={initial} />;
}
