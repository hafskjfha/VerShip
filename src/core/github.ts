import { execSync } from 'child_process';
import { GitManager } from '../utils/git.js';
import { logger } from '../utils/logger.js';

export interface GitHubReleaseConfig {
  token?: string;
  owner?: string;
  repo?: string;
  tag: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export class GitHubManager {
  private gitManager: GitManager;
  private cwd: string;
  
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.gitManager = new GitManager(cwd);
  }
  
  /**
   * GitHub CLI가 설치되어 있는지 확인합니다
   */
  isGitHubCliAvailable(): boolean {
    try {
      execSync('gh --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * GitHub CLI 인증 상태를 확인합니다
   */
  isAuthenticated(): boolean {
    try {
      execSync('gh auth status', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 원격 저장소 정보를 파싱합니다
   */
  parseRepositoryInfo(): { owner: string; repo: string } | null {
    const remoteUrl = this.gitManager.getRemoteUrl();
    if (!remoteUrl) return null;
    
    // GitHub URL 패턴들
    const patterns = [
      /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
      /github\.com\/([^/]+)\/([^/]+)/
    ];
    
    for (const pattern of patterns) {
      const match = remoteUrl.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2]
        };
      }
    }
    
    return null;
  }
  
  /**
   * GitHub Release를 생성합니다
   */
  async createRelease(config: GitHubReleaseConfig): Promise<void> {
    if (!this.isGitHubCliAvailable()) {
      throw new Error('GitHub CLI (gh)가 설치되어 있지 않습니다.');
    }
    
    if (!this.isAuthenticated()) {
      throw new Error('GitHub CLI 인증이 필요합니다. `gh auth login` 명령을 실행하세요.');
    }
    
    // 저장소 정보 자동 감지
    const repoInfo = this.parseRepositoryInfo();
    if (!repoInfo && (!config.owner || !config.repo)) {
      throw new Error('GitHub 저장소 정보를 찾을 수 없습니다.');
    }
    
    const owner = config.owner || repoInfo?.owner;
    const repo = config.repo || repoInfo?.repo;
    const releaseName = config.name || config.tag;
    
    try {
      let releaseCommand = `gh release create "${config.tag}"`;
      
      if (config.body) {
        // 임시 파일에 body 저장
        const fs = await import('fs/promises');
        const tmpFile = `/tmp/release-notes-${Date.now()}.md`;
        await fs.writeFile(tmpFile, config.body);
        releaseCommand += ` --notes-file "${tmpFile}"`;
      }
      
      if (releaseName !== config.tag) {
        releaseCommand += ` --title "${releaseName}"`;
      }
      
      if (config.draft) {
        releaseCommand += ' --draft';
      }
      
      if (config.prerelease) {
        releaseCommand += ' --prerelease';
      }
      
      if (owner && repo) {
        releaseCommand += ` --repo "${owner}/${repo}"`;
      }
      
      execSync(releaseCommand, { 
        cwd: this.cwd,
        stdio: 'pipe'
      });
      
      logger.info(`GitHub Release 생성됨: ${config.tag}`);
      
      // 임시 파일 정리
      if (config.body) {
        try {
          const fs = await import('fs/promises');
          const tmpFile = `/tmp/release-notes-${Date.now()}.md`;
          await fs.unlink(tmpFile);
        } catch {
          // 임시 파일 삭제 실패는 무시
        }
      }
      
    } catch (error) {
      throw new Error(`GitHub Release 생성 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * Release가 이미 존재하는지 확인합니다
   */
  releaseExists(tag: string): boolean {
    try {
      execSync(`gh release view "${tag}"`, { 
        cwd: this.cwd,
        stdio: 'ignore' 
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Release를 삭제합니다
   */
  deleteRelease(tag: string): void {
    try {
      execSync(`gh release delete "${tag}" --yes`, { 
        cwd: this.cwd,
        stdio: 'pipe' 
      });
      logger.info(`GitHub Release 삭제됨: ${tag}`);
    } catch (error) {
      throw new Error(`GitHub Release 삭제 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * 현재 저장소의 GitHub URL을 생성합니다
   */
  getRepositoryUrl(): string | null {
    const repoInfo = this.parseRepositoryInfo();
    if (!repoInfo) return null;
    
    return `https://github.com/${repoInfo.owner}/${repoInfo.repo}`;
  }
  
  /**
   * Release URL을 생성합니다
   */
  getReleaseUrl(tag: string): string | null {
    const baseUrl = this.getRepositoryUrl();
    if (!baseUrl) return null;
    
    return `${baseUrl}/releases/tag/${tag}`;
  }
}
