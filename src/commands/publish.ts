import { Command } from 'commander';
import inquirer from 'inquirer';
import { PublishManager, PublishConfig } from '../core/publish.js';
import { VersionManager } from '../core/version.js';
import { ChangelogManager } from '../core/changelog.js';
import { logger } from '../utils/logger.js';

interface PublishOptions {
  dryRun?: boolean;
  skipConfirm?: boolean;
  skipBuild?: boolean;
  skipTest?: boolean;
  skipGitPush?: boolean;
  skipNpmPublish?: boolean;
  skipGitHubRelease?: boolean;
  ci?: boolean;
  output?: 'text' | 'json';
  registry?: string;
  access?: 'public' | 'restricted';
  tag?: string;
}

export const publishCommand = new Command('publish')
  .description('패키지를 배포합니다')
  .option('--dry-run', '실제 배포하지 않고 시뮬레이션만 실행합니다')
  .option('--skip-confirm', '사용자 확인을 건너뜁니다')
  .option('--skip-build', '빌드 과정을 건너뜁니다')
  .option('--skip-test', '테스트 과정을 건너뜁니다')
  .option('--skip-git-push', 'Git 태그 푸시를 건너뜁니다')
  .option('--skip-npm-publish', 'NPM 배포를 건너뜁니다')
  .option('--skip-github-release', 'GitHub Release 생성을 건너뜁니다')
  .option('--ci', 'CI 환경에서 실행 (자동으로 --skip-confirm 적용)')
  .option('--output <type>', '출력 형식 (text|json)', 'text')
  .option('--registry <url>', 'NPM 레지스트리 URL')
  .option('--access <type>', '패키지 접근 권한 (public|restricted)', 'public')
  .option('--tag <name>', 'NPM 배포 태그', 'latest')
  .action(async (options: PublishOptions) => {
    try {
      const publishManager = new PublishManager();
      const versionManager = new VersionManager();
      const changelogManager = new ChangelogManager();
      
      // CI 모드 처리
      if (options.ci) {
        options.skipConfirm = true;
      }
      
      // 1. 배포 가능 상태 확인
      const canPublishCheck = await publishManager.canPublish();
      if (!canPublishCheck.canPublish) {
        if (options.output === 'json') {
          console.log(JSON.stringify({
            success: false,
            canPublish: false,
            reason: canPublishCheck.reason,
            needsRelease: false
          }));
        } else {
          console.log(`ℹ️  ${canPublishCheck.reason}`);
        }
        
        // CI 환경에서는 배포할 내용이 없어도 성공으로 처리
        if (options.ci) {
          process.exit(0);
        } else {
          process.exit(1);
        }
        return;
      }
      
      // 2. 현재 버전과 최신 태그 비교
      const currentVersion = await versionManager.getCurrentVersion();
      const changelogContent = await getChangelogForVersion(changelogManager, currentVersion);
      
      // 3. 배포 정보 표시
      if (options.output === 'text') {
        console.log('📦 릴리즈 준비 완료\n');
        console.log(`🏷️  배포할 버전: v${currentVersion}`);
        
        if (changelogContent) {
          console.log('\n📝 변경사항:');
          console.log(changelogContent);
        }
        
        if (options.dryRun) {
          console.log('\n🔍 DRY RUN 모드 - 실제 배포는 수행되지 않습니다');
        }
      }
      
      // 4. 사용자 확인 (대화형 모드)
      if (!options.skipConfirm && !options.dryRun) {
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: '계속하시겠습니까?',
            default: false
          }
        ]);
        
        if (!confirmed) {
          console.log('❌ 배포가 취소되었습니다.');
          process.exit(0);
        }
      }
      
      // 5. 배포 설정 구성
      const publishConfig: PublishConfig = {
        dryRun: options.dryRun,
        skipBuild: options.skipBuild,
        skipTest: options.skipTest,
        skipGitPush: options.skipGitPush,
        skipNpmPublish: options.skipNpmPublish,
        skipGitHubRelease: options.skipGitHubRelease,
        registry: options.registry,
        access: options.access,
        tag: options.tag
      };
      
      // 6. 배포 실행
      const result = await publishManager.publish(publishConfig);
      
      // 7. 결과 출력
      if (options.output === 'json') {
        console.log(JSON.stringify({
          success: result.success,
          version: result.version,
          gitTag: result.gitTag,
          npmPublished: result.npmPublished,
          gitPushed: result.gitPushed,
          gitHubReleaseCreated: result.gitHubReleaseCreated,
          gitHubReleaseUrl: result.gitHubReleaseUrl,
          dryRun: options.dryRun
        }));
      } else {
        console.log('\n✅ 릴리즈 완료!');
        console.log(`🏷️  버전: v${result.version}`);
        
        if (result.gitTag) {
          console.log(`🔗 태그: ${result.gitTag}`);
        }
        
        if (result.npmPublished) {
          const packageName = await getPackageName();
          console.log(`📦 NPM: https://www.npmjs.com/package/${packageName}`);
        }
        
        if (result.gitHubReleaseUrl) {
          console.log(`🎉 GitHub Release: ${result.gitHubReleaseUrl}`);
        }
        
        if (!options.dryRun) {
          console.log('🎉 배포가 성공적으로 완료되었습니다!');
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (options.output === 'json') {
        console.log(JSON.stringify({
          success: false,
          error: errorMessage
        }));
      } else {
        logger.error(`배포 실패: ${errorMessage}`);
      }
      
      process.exit(1);
    }
  });

/**
 * 특정 버전의 체인지로그 내용을 가져옵니다
 */
async function getChangelogForVersion(changelogManager: ChangelogManager, version: string): Promise<string | null> {
  try {
    const changelogPath = 'CHANGELOG.md';
    const fs = await import('fs/promises');
    
    try {
      const content = await fs.readFile(changelogPath, 'utf-8');
      
      // 해당 버전의 섹션 찾기
      const versionRegex = new RegExp(`## \\[?v?${version.replace(/\./g, '\\.')}\\]?[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
      const match = content.match(versionRegex);
      
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
      // CHANGELOG.md가 없으면 null 반환
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * package.json에서 패키지 이름을 가져옵니다
 */
async function getPackageName(): Promise<string> {
  try {
    const fs = await import('fs/promises');
    const packageJsonContent = await fs.readFile('package.json', 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    return packageJson.name || 'unknown';
  } catch {
    return 'unknown';
  }
}
