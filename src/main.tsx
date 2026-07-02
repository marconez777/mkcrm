import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // bootstrap react-i18next (F-INTL-1)
import { installSupportRuntimeWatcher } from "@/lib/support-runtime-watcher";

installSupportRuntimeWatcher();

createRoot(document.getElementById("root")!).render(<App />);

