import { AppShellLayout } from "./app/AppShellLayout";
import { ProjectCenterPage } from "./pages/ProjectCenterPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import { useUiStore } from "./state/uiStore";
import "./App.css";

export function App() {
  const currentPage = useUiStore((state) => state.currentPage);
  const setPage = useUiStore((state) => state.setPage);

  return (
    <AppShellLayout>
      {currentPage === "projects" ? (
        <ProjectCenterPage onOpenProject={() => setPage("workbench")} />
      ) : null}
      {currentPage === "workbench" || currentPage === "tasks" ? <WorkbenchPage /> : null}
      {currentPage === "settings" ? <SettingsPage /> : null}
    </AppShellLayout>
  );
}
