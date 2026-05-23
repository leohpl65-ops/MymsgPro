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

    // Call state handling - simulate incoming call regardless of route 
    // (Actual call listening is currently inside Chat component, moving it to App or a layout 
    // would be complex for a prototype, so we'll listen for any call targeting current user)
    let unsubscribeCall = () => {};
    if (currentUser) {
       import("firebase/database").then(({ ref, onValue }) => {
          import("@/lib/firebase").then(({ db }) => {
             const globalCallRef = ref(db, `calls/${currentUser.id}`);
             unsubscribeCall = onValue(globalCallRef, (snapshot) => {
                if (snapshot.exists()) {
                   const callData = snapshot.val();
                   // If we have an incoming call and we're not already on that chat page
                   if (callData.type === 'offer' && callData.from !== currentUser.id && location !== `/chat/${callData.chatId}`) {
                      setLocation(`/chat/${callData.chatId}`);
                   }
                }
             });
          });
       });
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
