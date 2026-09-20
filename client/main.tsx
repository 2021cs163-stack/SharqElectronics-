import { createRoot } from "react-dom/client";
import App from "./App";
import { CloudGate } from "./components/CloudGate";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<CloudGate><App /></CloudGate>);
}
