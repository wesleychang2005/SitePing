import { createRoot } from "react-dom/client";
import { useState } from "react";
import { SitepingInbox } from "@siteping/dashboard";

const KEY = "siteping_admin_key";
const PROJ = "siteping_projects";

function Login({ onDone }) {
  const [key, setKey] = useState("");
  const [projects, setProjects] = useState(localStorage.getItem(PROJ) || window.__DEFAULT_PROJECTS__ || "");
  const submit = async (e) => {
    e.preventDefault();
    const first = projects.split(",")[0].trim();
    const r = await fetch(`/api/siteping?projectName=${encodeURIComponent(first)}`, { headers: { Authorization: `Bearer ${key}` } });
    if (r.status === 401 || r.status === 403) return alert("Wrong admin key");
    sessionStorage.setItem(KEY, key);
    localStorage.setItem(PROJ, projects);
    onDone();
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 360, margin: "15vh auto", fontFamily: "system-ui", display: "grid", gap: 12 }}>
      <h2>SitePing inbox</h2>
      <label>Project name(s), comma-separated<input value={projects} onChange={(e) => setProjects(e.target.value)} required style={{ width: "100%" }} /></label>
      <label>Admin key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} required style={{ width: "100%" }} /></label>
      <button type="submit">Open inbox</button>
    </form>
  );
}

function App() {
  const [ready, setReady] = useState(!!sessionStorage.getItem(KEY) && !!localStorage.getItem(PROJ));
  if (!ready) return <Login onDone={() => setReady(true)} />;
  const projects = localStorage.getItem(PROJ).split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <div style={{ height: "100vh" }}>
      <button style={{ position: "fixed", right: 8, bottom: 8, zIndex: 10 }} onClick={() => { sessionStorage.removeItem(KEY); location.reload(); }}>Log out</button>
      <SitepingInbox projects={projects.length === 1 ? projects[0] : projects} endpoint="/api/siteping" apiKey={sessionStorage.getItem(KEY)} theme="auto" />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
