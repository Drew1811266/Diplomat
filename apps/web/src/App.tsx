import { AppShellLayout } from "./app/AppShellLayout";
import { ModelsPage } from "./pages/ModelsPage";
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
      {currentPage === "models" ? <ModelsPage /> : null}
      {currentPage === "tasks" ? <TasksPage /> : null}
      {currentPage === "settings" ? <SettingsPage /> : null}
    </AppShellLayout>
  );
}
