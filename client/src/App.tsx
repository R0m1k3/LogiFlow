import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToasterRobust } from "@/components/ToasterRobust";
import { TooltipProvider } from "@/components/ui/tooltip";
import RouterProduction from "@/components/RouterProduction";
import ErrorBoundary from "@/components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ToasterRobust />
          <RouterProduction />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
