import { execSync } from 'child_process';
import { GitManager } from '../utils/git.js';
import { VersionManager } from './version.js';
import { ChangelogManager } from './changelog.js';
import { GitHubManager } from './github.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export interface PublishConfig {
  registry?: string;
  access?: 'public' | 'restricted';
  tag?: string;
  dryRun?: boolean;
  skipBuild?: boolean;
  skipTest?: boolean;
  skipGitPush?: boolean;
  skipNpmPublish?: boolean;
  skipGitHubRelease?: boolean;
}

export interface PublishResult {
  success: boolean;
  version: string;
  gitTag?: string;
  npmPublished?: boolean;
  gitPushed?: boolean;
  gitHubReleaseCreated?: boolean;
  gitHubReleaseUrl?: string;
  errors?: string[];
}

export class PublishManager {
  private cwd: string;
  private gitManager: GitManager;
  private versionManager: VersionManager;
  private gitHubManager: GitHubManager;
  
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.gitManager = new GitManager(cwd);
    this.versionManager = new VersionManager(cwd);
    this.gitHubManager = new GitHubManager(cwd);
  }
  
  /**
   * 배포 전 사전 검증을 수행합니다
   */
  async validatePrePublish(config: PublishConfig): Promise<void> {
    const checks: Array<{ name: string; status: boolean; message: string; critical?: boolean }> = [];
    
    // 1. Git 저장소 확인
    const isGitRepo = this.gitManager.isGitRepository();
    checks.push({
      name: 'Git 저장소',
      status: isGitRepo,
      message: isGitRepo ? 'Git 저장소입니다' : 'Git 저장소가 아닙니다',
      critical: true
    });
    
    if (!isGitRepo) {
      throw new Error('Git 저장소가 아닙니다. 배포를 위해서는 Git 저장소가 필요합니다.');
    }
    
    // 2. Working directory clean 확인
    const isClean = this.gitManager.isWorkingDirectoryClean();
    checks.push({
      name: 'Working Directory',
      status: isClean,
      message: isClean ? 'Working directory가 clean합니다' : 'Uncommitted 변경사항이 있습니다',
      critical: true
    });
    
    if (!isClean) {
      throw new Error('Working directory가 clean하지 않습니다. 모든 변경사항을 커밋한 후 다시 시도하세요.');
    }
    
    // 3. 현재 브랜치 확인
    const currentBranch = this.gitManager.getCurrentBranch();
    const isMainBranch = ['main', 'master'].includes(currentBranch);
    checks.push({
      name: '브랜치',
      status: isMainBranch,
      message: `현재 브랜치: ${currentBranch}${isMainBranch ? '' : ' (권장: main/master)'}`,
      critical: false
    });
    
    // 4. package.json 확인
    const hasPackageJson = await this.checkPackageJson();
    checks.push({
      name: 'package.json',
      status: hasPackageJson,
      message: hasPackageJson ? 'package.json이 존재합니다' : 'package.json을 찾을 수 없습니다',
      critical: true
    });
    
    // 5. 빌드 스크립트 확인
    const hasBuildScript = await this.checkBuildScript();
    checks.push({
      name: '빌드 스크립트',
      status: hasBuildScript || Boolean(config.skipBuild),
      message: hasBuildScript ? 'build 스크립트가 있습니다' : 'build 스크립트가 없습니다',
      critical: false
    });
    
    // 6. 테스트 스크립트 확인
    const hasTestScript = await this.checkTestScript();
    checks.push({
      name: '테스트 스크립트',
      status: hasTestScript || Boolean(config.skipTest),
      message: hasTestScript ? 'test 스크립트가 있습니다' : 'test 스크립트가 없습니다',
      critical: false
    });
    
    // 7. npm 레지스트리 권한 확인 (실제로는 시도해봐야 알 수 있음)
    checks.push({
      name: 'NPM 권한',
      status: true,
      message: 'npm publish 시에 확인됩니다',
      critical: false
    });
    
    // 검증 결과 출력
    console.log('🔍 배포 준비 상태 검증...\n');
    checks.forEach(check => {
      const icon = check.status ? '✅' : (check.critical ? '❌' : '⚠️');
      console.log(`${icon} ${check.name}: ${check.message}`);
    });
    
    // Critical 체크 실패 시 에러
    const criticalFailures = checks.filter(c => c.critical && !c.status);
    if (criticalFailures.length > 0) {
      throw new Error(`필수 검증 실패: ${criticalFailures.map(c => c.name).join(', ')}`);
    }
    
    console.log();
  }
  
  /**
   * 빌드를 실행합니다
   */
  async runBuild(): Promise<void> {
    if (!await this.checkBuildScript()) {
      console.log('⚠️  build 스크립트가 없어 빌드를 건너뜁니다.');
      return;
    }
    
    try {
      console.log('🔨 프로젝트 빌드 중...');
      execSync('npm run build', { 
        cwd: this.cwd, 
        stdio: 'pipe' 
      });
      console.log('✅ 빌드 완료');
    } catch (error) {
      throw new Error(`빌드 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * 테스트를 실행합니다
   */
  async runTests(): Promise<void> {
    if (!await this.checkTestScript()) {
      console.log('⚠️  test 스크립트가 없어 테스트를 건너뜁니다.');
      return;
    }
    
    try {
      console.log('🧪 테스트 실행 중...');
      execSync('npm test', { 
        cwd: this.cwd, 
        stdio: 'pipe' 
      });
      console.log('✅ 테스트 통과');
    } catch (error) {
      throw new Error(`테스트 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * Git 태그를 생성하고 푸시합니다
   */
  async createAndPushTag(version: string): Promise<string> {
    const tag = `v${version}`;
    
    // 태그가 이미 존재하는지 확인
    if (this.gitManager.tagExists(tag)) {
      throw new Error(`태그 ${tag}가 이미 존재합니다.`);
    }
    
    // 태그 생성
    this.gitManager.createTag(tag, `Release ${tag}`);
    
    // 원격에 푸시
    this.gitManager.push(true); // --follow-tags
    
    return tag;
  }
  
  /**
   * NPM에 패키지를 배포합니다
   */
  async publishToNpm(config: PublishConfig): Promise<void> {
    try {
      let publishCommand = 'npm publish';
      
      if (config.access) {
        publishCommand += ` --access ${config.access}`;
      }
      
      if (config.tag) {
        publishCommand += ` --tag ${config.tag}`;
      }
      
      if (config.registry) {
        publishCommand += ` --registry ${config.registry}`;
      }
      
      if (config.dryRun) {
        publishCommand += ' --dry-run';
      }
      
      console.log('📦 NPM에 패키지 배포 중...');
      execSync(publishCommand, { 
        cwd: this.cwd, 
        stdio: 'pipe' 
      });
      
      if (config.dryRun) {
        console.log('✅ 배포 시뮬레이션 완료 (dry-run)');
      } else {
        console.log('✅ NPM 배포 완료');
      }
    } catch (error) {
      throw new Error(`NPM 배포 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * 전체 배포 프로세스를 실행합니다
   */
  async publish(config: PublishConfig = {}): Promise<PublishResult> {
    const result: PublishResult = {
      success: false,
      version: '',
      errors: []
    };
    
    try {
      // 1. 사전 검증
      await this.validatePrePublish(config);
      
      // 2. 현재 버전 확인
      const currentVersion = await this.versionManager.getCurrentVersion();
      result.version = currentVersion;
      
      // 3. 빌드 실행 (옵션)
      if (!config.skipBuild) {
        await this.runBuild();
      }
      
      // 4. 테스트 실행 (옵션)
      if (!config.skipTest) {
        await this.runTests();
      }
      
      // 5. Git 태그 생성 및 푸시 (옵션)
      if (!config.skipGitPush) {
        result.gitTag = await this.createAndPushTag(currentVersion);
        result.gitPushed = true;
        console.log(`✅ Git 태그 생성 및 푸시: ${result.gitTag}`);
      }
      
      // 6. NPM 배포 (옵션)
      if (!config.skipNpmPublish) {
        await this.publishToNpm(config);
        result.npmPublished = true;
      }
      
      // 7. GitHub Release 생성 (옵션)
      if (!config.skipGitHubRelease && !config.dryRun) {
        try {
          const releaseUrl = await this.createGitHubRelease(currentVersion);
          result.gitHubReleaseCreated = true;
          if (releaseUrl) {
            result.gitHubReleaseUrl = releaseUrl;
          }
          console.log(`✅ GitHub Release 생성: ${releaseUrl || '완료'}`);
        } catch (error) {
          // GitHub Release 실패는 전체 배포를 실패시키지 않음
          console.log(`⚠️  GitHub Release 생성 실패: ${error instanceof Error ? error.message : error}`);
        }
      }
      
      result.success = true;
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors = [errorMessage];
      
      // Git 태그가 생성되었지만 NPM 배포가 실패한 경우 롤백
      if (result.gitTag && !result.npmPublished && !config.skipNpmPublish) {
        try {
          console.log('🔄 Git 태그 롤백 중...');
          this.gitManager.deleteTag(result.gitTag);
          console.log('✅ Git 태그 롤백 완료');
        } catch (rollbackError) {
          const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
          result.errors.push(`태그 롤백 실패: ${rollbackMessage}`);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * package.json 파일이 존재하는지 확인합니다
   */
  private async checkPackageJson(): Promise<boolean> {
    try {
      await fs.access(path.join(this.cwd, 'package.json'));
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * build 스크립트가 있는지 확인합니다
   */
  private async checkBuildScript(): Promise<boolean> {
    try {
      const packageJsonPath = path.join(this.cwd, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      return !!(packageJson.scripts && packageJson.scripts.build);
    } catch {
      return false;
    }
  }
  
  /**
   * test 스크립트가 있는지 확인합니다
   */
  private async checkTestScript(): Promise<boolean> {
    try {
      const packageJsonPath = path.join(this.cwd, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      return !!(packageJson.scripts && packageJson.scripts.test);
    } catch {
      return false;
    }
  }
  
  /**
   * 배포 가능한 상태인지 확인합니다
   */
  async canPublish(): Promise<{ canPublish: boolean; reason?: string }> {
    try {
      // 최신 커밋이 release 커밋인지 확인
      const currentVersion = await this.versionManager.getCurrentVersion();
      const latestTag = this.gitManager.getLatestTag();
      
      if (latestTag === `v${currentVersion}`) {
        return {
          canPublish: false,
          reason: '이미 현재 버전이 배포되었습니다.'
        };
      }
      
      return { canPublish: true };
    } catch {
      return {
        canPublish: false,
        reason: '배포 상태를 확인할 수 없습니다.'
      };
    }
  }
  
  /**
   * GitHub Release를 생성합니다
   */
  private async createGitHubRelease(version: string): Promise<string | null> {
    // GitHub CLI 사용 가능성 확인
    if (!this.gitHubManager.isGitHubCliAvailable()) {
      throw new Error('GitHub CLI (gh)가 설치되어 있지 않습니다.');
    }
    
    // 인증 확인
    if (!this.gitHubManager.isAuthenticated()) {
      throw new Error('GitHub CLI 인증이 필요합니다. `gh auth login` 명령을 실행하세요.');
    }
    
    // 체인지로그에서 release notes 가져오기
    const releaseNotes = await this.getReleaseNotes(version);
    
    // Release 생성
    await this.gitHubManager.createRelease({
      tag: `v${version}`,
      name: `Release v${version}`,
      body: releaseNotes || `Release v${version}`,
      draft: false,
      prerelease: false
    });
    
    return this.gitHubManager.getReleaseUrl(`v${version}`);
  }
  
  /**
   * 체인지로그에서 릴리즈 노트를 가져옵니다
   */
  private async getReleaseNotes(version: string): Promise<string | null> {
    try {
      const changelogPath = path.join(this.cwd, 'CHANGELOG.md');
      const content = await fs.readFile(changelogPath, 'utf-8');
      
      // 해당 버전의 섹션 찾기
      const versionRegex = new RegExp(`## \\[?v?${version.replace(/\./g, '\\.')}\\]?[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
      const match = content.match(versionRegex);
      
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
      // CHANGELOG.md가 없거나 읽기 실패
    }
    
    return null;
  }
}
