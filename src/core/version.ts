import fs from 'fs/promises';
import path from 'path';
import { ChangeType, Changeset } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface VersionInfo {
  current: string;
  next: string;
  hasChanges: boolean;
  changesByType: {
    major: number;
    minor: number;
    patch: number;
  };
}

export class VersionManager {
  private cwd: string;
  
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }
  
  /**
   * package.json에서 현재 버전을 읽어옵니다
   */
  async getCurrentVersion(): Promise<string> {
    try {
      const packageJsonPath = path.join(this.cwd, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      if (!packageJson.version) {
        throw new Error('package.json에 version 필드가 없습니다.');
      }
      
      return packageJson.version;
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error('package.json 파일을 찾을 수 없습니다.');
      }
      throw error;
    }
  }
  
  /**
   * package.json의 버전을 업데이트합니다
   */
  async updateVersion(newVersion: string): Promise<void> {
    try {
      const packageJsonPath = path.join(this.cwd, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      packageJson.version = newVersion;
      
      // 들여쓰기와 줄바꿈을 유지하여 저장
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      
      logger.info(`버전이 업데이트되었습니다: ${newVersion}`);
    } catch (error) {
      throw new Error(`package.json 업데이트 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * Semantic versioning 규칙에 따라 다음 버전을 계산합니다
   */
  calculateNextVersion(currentVersion: string, changesets: Changeset[]): VersionInfo {
    const parsed = this.parseVersion(currentVersion);
    
    if (changesets.length === 0) {
      return {
        current: currentVersion,
        next: currentVersion,
        hasChanges: false,
        changesByType: { major: 0, minor: 0, patch: 0 }
      };
    }
    
    // 변경사항을 타입별로 분류
    const changesByType = changesets.reduce(
      (acc, changeset) => {
        acc[changeset.type]++;
        return acc;
      },
      { major: 0, minor: 0, patch: 0 }
    );
    
    // Semantic versioning 규칙 적용
    let { major, minor, patch } = parsed;
    
    if (changesByType.major > 0) {
      // Major 변경: X.0.0
      major++;
      minor = 0;
      patch = 0;
    } else if (changesByType.minor > 0) {
      // Minor 변경: X.Y.0
      minor++;
      patch = 0;
    } else if (changesByType.patch > 0) {
      // Patch 변경: X.Y.Z
      patch++;
    }
    
    const nextVersion = `${major}.${minor}.${patch}`;
    
    return {
      current: currentVersion,
      next: nextVersion,
      hasChanges: true,
      changesByType
    };
  }
  
  /**
   * 버전 문자열을 파싱합니다
   */
  private parseVersion(version: string): { major: number; minor: number; patch: number } {
    // v 접두사 제거
    const cleanVersion = version.replace(/^v/, '');
    
    const parts = cleanVersion.split('.');
    if (parts.length !== 3) {
      throw new Error(`유효하지 않은 버전 형식입니다: ${version}`);
    }
    
    const [major, minor, patch] = parts.map(part => {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0) {
        throw new Error(`유효하지 않은 버전 번호입니다: ${part}`);
      }
      return num;
    });
    
    return { major, minor, patch };
  }
  
  /**
   * 버전이 유효한 semantic version인지 확인합니다
   */
  isValidVersion(version: string): boolean {
    try {
      this.parseVersion(version);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 두 버전을 비교합니다
   * @returns -1: v1 < v2, 0: v1 === v2, 1: v1 > v2
   */
  compareVersions(v1: string, v2: string): number {
    const parsed1 = this.parseVersion(v1);
    const parsed2 = this.parseVersion(v2);
    
    if (parsed1.major !== parsed2.major) {
      return parsed1.major - parsed2.major;
    }
    if (parsed1.minor !== parsed2.minor) {
      return parsed1.minor - parsed2.minor;
    }
    return parsed1.patch - parsed2.patch;
  }
}
