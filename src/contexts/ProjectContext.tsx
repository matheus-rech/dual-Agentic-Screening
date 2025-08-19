import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ProjectData {
  id?: string;
  name: string;
  importFormat: string;
  uploadedFile?: File;
  references?: any[];
}

interface ProjectContextType {
  projectData: ProjectData;
  setProjectData: (data: Partial<ProjectData>) => void;
  clearProject: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [projectData, setProjectDataState] = useState<ProjectData>({
    name: '',
    importFormat: 'auto-detect',
  });

  const setProjectData = (data: Partial<ProjectData>) => {
    setProjectDataState(prev => ({ ...prev, ...data }));
  };

  const clearProject = () => {
    setProjectDataState({
      name: '',
      importFormat: 'auto-detect',
    });
  };

  return (
    <ProjectContext.Provider value={{ projectData, setProjectData, clearProject }}>
      {children}
    </ProjectContext.Provider>
  );
};