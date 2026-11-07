import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/about" component={Home} />
    <Route path="/login" component={Login} />
    <Route path="/tasbih" component={Home} />
    <Route path="/tools" component={Home} />
    <Route path="/prayer" component={Home} />
    <Route path="/khatma" component={Home} />
    <Route path="/zakat" component={Home} />
    <Route path="/quran" component={Home} />
    <Route path="/sunnah" component={Home} />
    <Route path="/library" component={Home} />
    <Route path="/learning" component={Home} />
    <Route path="/adhkar" component={Home} />
    <Route path="/rafiq" component={Home} />
    <Route path="/dashboard" component={Home} />
    <Route path="/owner" component={Home} />
    <Route path="/permissions" component={Home} />
    <Route path="/privacy" component={Home} />
    <Route path="/explore" component={Home} />
    <Route path="/names" component={Home} />
    <Route path="/events" component={Home} />
    <Route path="/seerah" component={Home} />
    <Route path="/prophets" component={Home} />
    <Route path="/duas" component={Home} />
    <Route path="/ramadan" component={Home} />
    <Route path="/hajj" component={Home} />
    <Route path="/salah" component={Home} />
    <Route path="/fiqh" component={Home} />
    <Route path="/tajweed" component={Home} />
    <Route path="/hifz" component={Home} />
    <Route path="/kids" component={Home} />
    <Route path="/achievements" component={Home} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary>
    <ThemeProvider defaultTheme="dark" switchable>
      <TooltipProvider><Toaster /><Router /></TooltipProvider>
    </ThemeProvider>
  </ErrorBoundary>;
}
