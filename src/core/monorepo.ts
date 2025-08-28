import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { PackageInfo, MonorepoConfig } from '../types/index.js';

export class MonorepoManager {
  private cwd: string;
  
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }
  
  /**
   * 현재 프로젝트가 monorepo인지 확인합니다
   */
  async isMonorepo(): Promise<boolean> {
    try {
      const packageJsonPath = path.join(this.cwd, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      // workspaces 필드가 있으면 monorepo로 간주
      return !!(packageJson.workspaces || packageJson.workspaces?.packages);
    } catch {
      return false;
    }
  }
  
  /**
   * 모든 패키지 정보를 가져옵니다
   */
  async getPackages(): Promise<PackageInfo[]> {
    const config = await this.getMonorepoConfig();
    if (!config.packages.length) {
      return [];
    }
    
    const packages: PackageInfo[] = [];
    
    for (const pattern of config.packages) {
      const packagePaths = await glob(pattern, {
        cwd: this.cwd,
      });
      
      for (const packagePath of packagePaths) {
        try {
          const fullPath = path.join(this.cwd, packagePath);
          
          // 디렉토리인지 확인
          const stat = await fs.stat(fullPath);
          if (!stat.isDirectory()) continue;
          
          const packageJsonPath = path.join(fullPath, 'package.json');
          const content = await fs.readFile(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(content);
          
          if (packageJson.name && !config.ignore?.includes(packageJson.name)) {
            packages.push({
              name: packageJson.name,
              path: packagePath,
              version: packageJson.version || '0.0.0',
              private: packageJson.private,
            });
          }
        } catch {
          // 패키지 정보를 읽을 수 없으면 건너뜀
        }
      }
    }
    
    return packages.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  /**
   * 특정 패키지의 정보를 가져옵니다
   */
  async getPackage(nameOrPath: string): Promise<PackageInfo | null> {
    const packages = await this.getPackages();
    return packages.find(pkg => 
      pkg.name === nameOrPath || pkg.path === nameOrPath
    ) || null;
  }
  
  /**
   * Monorepo 설정을 가져옵니다
   */
  async getMonorepoConfig(): Promise<MonorepoConfig> {
    try {
      const packageJsonPath = path.join(this.cwd, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      // package.json의 workspaces 설정 확인
      let packages: string[] = [];
      if (packageJson.workspaces) {
        if (Array.isArray(packageJson.workspaces)) {
          packages = packageJson.workspaces;
        } else if (packageJson.workspaces.packages) {
          packages = packageJson.workspaces.packages;
        }
      }
      
      // vership 설정 확인
      const vershipConfig = packageJson.vership || {};
      
      return {
        packages: packages,
        ignore: vershipConfig.ignore || [],
        changesetDir: vershipConfig.changesetDir || '.changesets',
      };
    } catch {
      return {
        packages: [],
        ignore: [],
        changesetDir: '.changesets',
      };
    }
  }
  
  /**
   * 변경된 패키지 목록을 감지합니다 (Git 기반)
   */
  async getChangedPackages(since?: string): Promise<string[]> {
    // Git 기반 변경 감지는 나중에 구현
    // 현재는 빈 배열 반환
    return [];
  }
}
