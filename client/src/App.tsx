import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { StoreProvider } from "@/lib/store";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ContactsPage from "@/pages/contacts";
import ChatPage from "@/pages/chat";
import NotFound from "@/pages/not-found";

function Router() {
  const [location, setLocation] = useLocation();
  const { currentUser } = useStore();

  useEffect(() => {
    // If not logged in, enforce redirect to login or register
    if (!currentUser && location !== "/" && location !== "/register") {
       setLocation("/");
       return;
    }

    // Handling direct links for logged in users
    if (currentUser) {
      // Auto-add contact if opening a direct chat link
      if (location.startsWith("/chat/dm-")) {
        const parts = location.split("/chat/dm-")[1]?.split("-");
        if (parts && parts.length >= 2) {
          const targetId = parts[0] === currentUser.id ? parts[1] : parts[0];
          // We don't auto-add here anymore, we let the chat open and only add if they send a message.
        }
      }
    }
  }, [location, currentUser, setLocation]);

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
