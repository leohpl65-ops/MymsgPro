import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { StoreProvider } from "@/lib/store";

import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ContactsPage from "@/pages/contacts";
import ChatPage from "@/pages/chat";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/contacts" component={ContactsPage} />
      <Route path="/chat/:id" component={ChatPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <StoreProvider>
      <Router />
      <Toaster />
    </StoreProvider>
  );
}

export default App;
