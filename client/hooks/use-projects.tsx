import { appStorage } from '@/lib/app-storage';
import React, { createContext, useContext, useState, useEffect } from 'react';

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface ProjectMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  actualCost?: number;
  procured: boolean;
  notes?: string;
}

export interface ProjectService {
  id: string;
  description: string;
  assignedTo?: string;
  estimatedCost?: number;
  actualCost?: number;
  status: 'pending' | 'in_progress' | 'done';
}

export interface Project {
  id: string;
  projectNo: string;       // PRJ-0001
  name: string;
  customerName: string;
  customerPhone?: string;
  address?: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  dueDate?: string;
  completedDate?: string;
  estimatedTotal?: number;
  actualTotal?: number;
  amountPaid: number;
  materials: ProjectMaterial[];
  services: ProjectService[];
  linkedJobIds: string[];  // linked service job IDs
  notes?: string;
  createdBy: string;
  dateCreated: string;
}

interface ProjectsContextType {
  projects: Project[];
  addProject: (p: Omit<Project,'id'|'projectNo'|'dateCreated'|'amountPaid'|'materials'|'services'|'linkedJobIds'|'createdBy'>, createdBy: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addMaterial: (projectId: string, m: Omit<ProjectMaterial,'id'>) => void;
  updateMaterial: (projectId: string, materialId: string, updates: Partial<ProjectMaterial>) => void;
  deleteMaterial: (projectId: string, materialId: string) => void;
  addService: (projectId: string, s: Omit<ProjectService,'id'>) => void;
  updateService: (projectId: string, serviceId: string, updates: Partial<ProjectService>) => void;
  linkJob: (projectId: string, jobId: string) => void;
  unlinkJob: (projectId: string, jobId: string) => void;
}

const Ctx = createContext<ProjectsContextType | undefined>(undefined);

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`.toUpperCase();

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    try { const s = appStorage.getItem('shopshield_projects'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

  useEffect(() => { appStorage.setItem('shopshield_projects', JSON.stringify(projects)); }, [projects]);

  const nextNo = () => {
    const max = projects.reduce((a, p) => {
      const n = parseInt(p.projectNo.replace('PRJ-', ''));
      return isNaN(n) ? a : Math.max(a, n);
    }, 0);
    return `PRJ-${String(max + 1).padStart(4, '0')}`;
  };

  const addProject = (p: Omit<Project,'id'|'projectNo'|'dateCreated'|'amountPaid'|'materials'|'services'|'linkedJobIds'|'createdBy'>, createdBy: string) => {
    const newP: Project = {
      ...p, id: uid(), projectNo: nextNo(),
      dateCreated: new Date().toISOString().split('T')[0],
      amountPaid: 0, materials: [], services: [], linkedJobIds: [], createdBy,
    };
    setProjects(prev => [newP, ...prev]);
  };

  const updateProject = (id: string, updates: Partial<Project>) =>
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

  const deleteProject = (id: string) =>
    setProjects(prev => prev.filter(p => p.id !== id));

  const addMaterial = (projectId: string, m: Omit<ProjectMaterial,'id'>) =>
    updateProject(projectId, {
      materials: [...(projects.find(p => p.id === projectId)?.materials || []), { ...m, id: uid() }]
    });

  const updateMaterial = (projectId: string, materialId: string, updates: Partial<ProjectMaterial>) =>
    updateProject(projectId, {
      materials: projects.find(p => p.id === projectId)?.materials.map(m =>
        m.id === materialId ? { ...m, ...updates } : m) || []
    });

  const deleteMaterial = (projectId: string, materialId: string) =>
    updateProject(projectId, {
      materials: projects.find(p => p.id === projectId)?.materials.filter(m => m.id !== materialId) || []
    });

  const addService = (projectId: string, s: Omit<ProjectService,'id'>) =>
    updateProject(projectId, {
      services: [...(projects.find(p => p.id === projectId)?.services || []), { ...s, id: uid() }]
    });

  const updateService = (projectId: string, serviceId: string, updates: Partial<ProjectService>) =>
    updateProject(projectId, {
      services: projects.find(p => p.id === projectId)?.services.map(s =>
        s.id === serviceId ? { ...s, ...updates } : s) || []
    });

  const linkJob = (projectId: string, jobId: string) => {
    const p = projects.find(x => x.id === projectId);
    if (p && !p.linkedJobIds.includes(jobId))
      updateProject(projectId, { linkedJobIds: [...p.linkedJobIds, jobId] });
  };

  const unlinkJob = (projectId: string, jobId: string) =>
    updateProject(projectId, {
      linkedJobIds: projects.find(p => p.id === projectId)?.linkedJobIds.filter(j => j !== jobId) || []
    });

  return (
    <Ctx.Provider value={{ projects, addProject, updateProject, deleteProject,
      addMaterial, updateMaterial, deleteMaterial, addService, updateService, linkJob, unlinkJob }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProjects must be within ProjectsProvider');
  return ctx;
}
