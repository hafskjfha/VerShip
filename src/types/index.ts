// src/types/index.ts
export type ChangeType = 'major' | 'minor' | 'patch';

export interface Changeset {
  id: string;
  type: ChangeType;
  summary: string;
  packages?: Record<string, ChangeType>;
  author?: string;
  pr?: number;
  createdAt: string;
}

export interface ProjectConfig {
  packages?: string[];
  changelog?: {
    template?: string;
    categories?: string[];
  };
  git?: {
    commitMessage?: string;
    tagPrefix?: string;
  };
  publish?: {
    registry?: string;
    access?: 'public' | 'restricted';
  };
}

export interface ProjectStatus {
  currentVersion: string;
  latestTag?: string;
  pendingChangesets: Changeset[];
  needsPublish: boolean;
  nextVersion?: string;
}