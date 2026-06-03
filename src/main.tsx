import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installSupportRuntimeWatcher } from "@/lib/support-runtime-watcher";

installSupportRuntimeWatcher();

createRoot(document.getElementById("root")!).render(<App />);
