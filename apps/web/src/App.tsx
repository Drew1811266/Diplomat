import { AppShellLayout } from "./app/AppShellLayout";
import { HelpPage } from "./pages/HelpPage";
import { ProjectCenterPage } from "./pages/ProjectCenterPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TasksPage } from "./pages/TasksPage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import { useUiStore } from "./state/uiStore";
import "./App.css";

export function App() {
  const currentPage = useUiStore((state) => state.currentPage);
  const setPage = useUiStore((state) => state.setPage);
  const setActiveProjectId = useUiStore((state) => state.setActiveProjectId);

  function openProject(projectId: string) {
    setActiveProjectId(projectId);
    setPage("workbench");
  }

  return (
    <AppShellLayout>
      {currentPage === "projects" ? (
        <ProjectCenterPage onOpenProject={openProject} />
      ) : null}
      {currentPage === "workbench" ? <WorkbenchPage /> : null}
      {currentPage === "tasks" ? <TasksPage /> : null}
      {currentPage === "help" ? <HelpPage /> : null}
      {currentPage === "settings" ? <SettingsPage /> : null}
    </AppShellLayout>
  );
}
