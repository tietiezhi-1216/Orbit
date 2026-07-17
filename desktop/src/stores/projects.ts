import { create } from "zustand";
import {
  addProject,
  errorMessage,
  listProjects,
  renameProject,
  touchProject,
} from "@/lib/api";
import type { Project } from "@/lib/api";

interface ProjectState {
  projects: Project[];
  init: () => Promise<void>;
  add: (path: string) => Promise<Project>;
  rename: (id: string, name: string) => Promise<Project>;
  markUsed: (id: string) => Promise<void>;
}

const newestFirst = (projects: Project[]): Project[] =>
  [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

export const useProjectStore = create<ProjectState>()((set) => ({
  projects: [],

  async init() {
    try {
      set({ projects: newestFirst(await listProjects()) });
    } catch (err) {
      console.error("加载项目列表失败：", errorMessage(err));
    }
  },

  async add(path) {
    const project = await addProject(path);
    set((state) => ({
      projects: newestFirst([
        project,
        ...state.projects.filter((item) => item.id !== project.id),
      ]),
    }));
    return project;
  },

  async rename(id, name) {
    const project = await renameProject(id, name);
    set((state) => ({
      projects: state.projects.map((item) => (item.id === id ? project : item)),
    }));
    return project;
  },

  async markUsed(id) {
    try {
      const project = await touchProject(id);
      set((state) => ({
        projects: newestFirst([
          project,
          ...state.projects.filter((item) => item.id !== id),
        ]),
      }));
    } catch (err) {
      console.error("更新最近项目失败：", errorMessage(err));
    }
  },
}));
