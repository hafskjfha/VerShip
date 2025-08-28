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

export interface PackageInfo {
  name: string;
  path: string;
  version: string;
  private?: boolean;
}

export interface MonorepoConfig {
  packages: string[];   // 패키지 경로 패턴 (예: ["packages/*", "apps/*"])
  ignore?: string[];    // 무시할 패키지
  changesetDir?: string; // changeset 디렉토리 (기본: .changesets)
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