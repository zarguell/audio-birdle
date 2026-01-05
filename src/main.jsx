import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Toaster } from "sonner";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      expand={false}
      richColors
      closeButton
      duration={4000}
      gap={8}
      toastOptions={{
        classNames: {
          toast: "rounded-lg border-l-4 shadow-lg",
          success: "bg-green-50 border-green-500 text-green-800",
          error: "bg-red-50 border-red-500 text-red-800",
          info: "bg-blue-50 border-blue-500 text-blue-800",
        },
      }}
    />
  </StrictMode>,
);
