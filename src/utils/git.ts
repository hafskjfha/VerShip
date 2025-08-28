import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';

export class GitManager {
  private cwd: string;
  
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }
  
  /**
   * Git이 설치되어 있고 저장소가 초기화되어 있는지 확인합니다
   */
  isGitRepository(): boolean {
    try {
      execSync('git rev-parse --git-dir', { 
        cwd: this.cwd, 
        stdio: 'ignore' 
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Working directory가 clean한지 확인합니다
   */
  isWorkingDirectoryClean(): boolean {
    try {
      const status = execSync('git status --porcelain', {
        cwd: this.cwd,
        encoding: 'utf-8'
      });
      return status.trim() === '';
    } catch {
      return false;
    }
  }
  
  /**
   * 현재 브랜치 이름을 가져옵니다
   */
  getCurrentBranch(): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.cwd,
        encoding: 'utf-8'
      }).trim();
    } catch {
      throw new Error('현재 브랜치를 확인할 수 없습니다.');
    }
  }
  
  /**
   * 최신 Git 태그를 가져옵니다
   */
  getLatestTag(): string | null {
    try {
      const tag = execSync('git describe --tags --abbrev=0', {
        cwd: this.cwd,
        encoding: 'utf-8'
      }).trim();
      return tag;
    } catch {
      return null; // 태그가 없는 경우
    }
  }
  
  /**
   * 특정 태그가 존재하는지 확인합니다
   */
  tagExists(tag: string): boolean {
    try {
      execSync(`git rev-parse ${tag}`, {
        cwd: this.cwd,
        stdio: 'ignore'
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 파일들을 staging area에 추가합니다
   */
  addFiles(files: string[]): void {
    try {
      for (const file of files) {
        execSync(`git add "${file}"`, { cwd: this.cwd });
      }
    } catch (error) {
      throw new Error(`파일 추가 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * 커밋을 생성합니다
   */
  commit(message: string): void {
    try {
      execSync(`git commit -m "${message}"`, { cwd: this.cwd });
      logger.info(`커밋 생성됨: ${message}`);
    } catch (error) {
      throw new Error(`커밋 생성 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * Git 태그를 생성합니다
   */
  createTag(tag: string, message?: string): void {
    try {
      const tagCommand = message 
        ? `git tag -a "${tag}" -m "${message}"`
        : `git tag "${tag}"`;
        
      execSync(tagCommand, { cwd: this.cwd });
      logger.info(`Git 태그 생성됨: ${tag}`);
    } catch (error) {
      throw new Error(`태그 생성 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * 태그를 삭제합니다 (로컬과 원격)
   */
  deleteTag(tag: string, deleteRemote = true): void {
    try {
      // 로컬 태그 삭제
      execSync(`git tag -d "${tag}"`, { cwd: this.cwd });
      
      // 원격 태그 삭제 (선택적)
      if (deleteRemote) {
        try {
          execSync(`git push origin --delete "${tag}"`, { cwd: this.cwd });
        } catch {
          // 원격 태그가 없을 수 있으므로 무시
        }
      }
      
      logger.info(`Git 태그 삭제됨: ${tag}`);
    } catch (error) {
      throw new Error(`태그 삭제 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * 원격 저장소에 푸시합니다
   */
  push(includeTags = false): void {
    try {
      const pushCommand = includeTags ? 'git push --follow-tags' : 'git push';
      execSync(pushCommand, { cwd: this.cwd });
      logger.info('원격 저장소에 푸시 완료');
    } catch (error) {
      throw new Error(`푸시 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * staged 파일 목록을 가져옵니다
   */
  getStagedFiles(): string[] {
    try {
      const output = execSync('git diff --cached --name-only', {
        cwd: this.cwd,
        encoding: 'utf-8'
      });
      return output.trim().split('\n').filter(line => line.length > 0);
    } catch {
      return [];
    }
  }
  
  /**
   * 사용자 정보를 가져옵니다
   */
  getUserInfo(): { name: string; email: string } {
    try {
      const name = execSync('git config user.name', {
        cwd: this.cwd,
        encoding: 'utf-8'
      }).trim();
      
      const email = execSync('git config user.email', {
        cwd: this.cwd,
        encoding: 'utf-8'
      }).trim();
      
      return { name, email };
    } catch {
      return { name: 'Unknown', email: 'unknown@example.com' };
    }
  }
  
  /**
   * 원격 저장소 URL을 가져옵니다
   */
  getRemoteUrl(remote = 'origin'): string | null {
    try {
      const url = execSync(`git remote get-url ${remote}`, {
        cwd: this.cwd,
        encoding: 'utf-8'
      }).trim();
      return url;
    } catch {
      return null;
    }
  }
  
  /**
   * 현재 커밋 해시를 가져옵니다
   */
  getCurrentCommit(): string {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.cwd,
        encoding: 'utf-8'
      }).trim();
    } catch {
      throw new Error('현재 커밋을 확인할 수 없습니다.');
    }
  }
  
  /**
   * 두 커밋 사이의 변경사항을 가져옵니다
   */
  getCommitsSince(since: string): string[] {
    try {
      const output = execSync(`git log ${since}..HEAD --oneline`, {
        cwd: this.cwd,
        encoding: 'utf-8'
      });
      
      return output.trim().split('\n').filter(line => line.length > 0);
    } catch {
      return [];
    }
  }
}
