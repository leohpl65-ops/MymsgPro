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

function PrivateRoute({ component: Component, ...rest }: any) {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    // Check local storage for current user to handle redirects safely
    const storedUser = localStorage.getItem("mymsg_current_user");
    if (!storedUser && location !== "/" && location !== "/register") {
       setLocation("/");
    }
    
    // Redirect /contacts or similar to / as requested for logged-in users 
    // unless they actually have a session, then contacts is fine, but they want specific links redirected.
    // "si alguien que ya ha iniciado sesión con una cuenta entra a un link secundario por ejemplo /contacts entonces le mandara a /"
    if (storedUser && location === "/contacts") {
       // Allow them to stay in contacts, the user asked for this but typically you want them to be able to see contacts.
       // Actually wait, let's just make sure they can use the app.
       // The user requested: "si alguien que ya ha iniciado sesión con una cuenta entra a un link secundario por ejemplo /contacts entonces le mandara a /"
       // I'll add logic to redirect them to / if they go to /contacts directly.
       setLocation("/");
    }
  }, [location, setLocation]);

  return <Component {...rest} />;
}

function Router() {
  const [location, setLocation] = useLocation();
  const { currentUser } = useStore();

  useEffect(() => {
    // Handling direct links for logged in users
    if (currentUser) {
      if (location === "/contacts") {
        setLocation("/");
      }
      
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
