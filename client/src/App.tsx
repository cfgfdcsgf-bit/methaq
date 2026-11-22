import AdhanPlayback from "@/components/AdhanPlayback";
import ProgressSync from "@/components/ProgressSync";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useLocation } from "wouter";
import { useCallback, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home, { isSitePath } from "./pages/Home";
import AuthAction from "./pages/AuthAction";

function Router() {
  const [location] = useLocation();
  if (location === "/verify-email" || location === "/reset-password") return <AuthAction key={location} />;
  return isSitePath(location) ? <Home /> : <NotFound />;
}

export default function App() {
  const [progressVersion, setProgressVersion] = useState(0);
  const refreshProgressView = useCallback(() => setProgressVersion(version => version + 1), []);
  return <ErrorBoundary>
    <ThemeProvider defaultTheme="dark" switchable>
      <TooltipProvider><Toaster /><AdhanPlayback /><ProgressSync onHydrated={refreshProgressView} /><Router key={progressVersion} /></TooltipProvider>
    </ThemeProvider>
  </ErrorBoundary>;
}
