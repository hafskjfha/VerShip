import inquirer from 'inquirer';
import chalk from 'chalk';
import { ChangesetManager } from '../core/changeset.js';
import { VersionManager } from '../core/version.js';
import { ChangelogManager } from '../core/changelog.js';
import { ChangelogConfigManager } from '../core/changelog-config.js';
import { GitManager } from '../utils/git.js';
import { logger } from '../utils/logger.js';

interface VersionOptions {
  dryRun?: boolean;
  skipConfirm?: boolean;
  ci?: boolean;
}

export async function versionCommand(options: VersionOptions = {}): Promise<void> {
  try {
    const changesetManager = new ChangesetManager();
    const versionManager = new VersionManager();
    const changelogConfigManager = new ChangelogConfigManager();
    const gitManager = new GitManager();
    
    console.log('🔍 버전 업데이트 준비 중...\n');
    
    // 1. 사전 검증
    await performPreChecks(gitManager, options);
    
    // 2. 현재 상태 확인
    const currentVersion = await versionManager.getCurrentVersion();
    const changesets = await changesetManager.getAllChangesets();
    
    if (changesets.length === 0) {
      console.log('📝 처리할 changeset이 없습니다.');
      if (options.ci) {
        process.exit(0); // CI 환경에서는 성공으로 처리
      } else {
        return;
      }
    }
    
    // 3. 다음 버전 계산
    const versionInfo = versionManager.calculateNextVersion(currentVersion, changesets);
    
    // 4. 미리보기 표시
    displayVersionPreview(versionInfo, changesets);
    
    if (options.dryRun) {
      console.log('\n🔍 Dry run 모드: 실제 변경은 수행되지 않습니다.');
      return;
    }
    
    // 5. 사용자 확인 (CI 모드가 아닌 경우)
    if (!options.ci && !options.skipConfirm) {
      const { confirmed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: '버전 업데이트를 진행하시겠습니까?',
        default: true,
      }]);
      
      if (!confirmed) {
        console.log('❌ 버전 업데이트가 취소되었습니다.');
        return;
      }
    }
    
    console.log('\n🚀 버전 업데이트 시작...\n');
    
    // 6. package.json 버전 업데이트
    await versionManager.updateVersion(versionInfo.next);
    console.log(`✅ package.json 업데이트 완료: ${chalk.cyan(versionInfo.next)}`);
    
    // 7. CHANGELOG.md 업데이트 (설정 적용)
    const changelogConfig = await changelogConfigManager.loadConfig();
    const changelogManager = new ChangelogManager(process.cwd(), changelogConfig);
    
    await changelogManager.addEntry(versionInfo.next, changesets);
    console.log(`✅ CHANGELOG.md 업데이트 완료 (${changelogConfig.template} 템플릿)`);
    
    // 8. changeset 파일들 정리 (소비)
    const consumedChangesets = await changesetManager.consumeChangesets();
    console.log(`✅ ${consumedChangesets.length}개의 changeset 파일 정리 완료`);
    
    // 9. Git 커밋 생성
    if (gitManager.isGitRepository()) {
      const commitMessage = `chore: release v${versionInfo.next}`;
      
      gitManager.addFiles(['package.json', 'CHANGELOG.md']);
      gitManager.commit(commitMessage);
      
      console.log(`✅ Git 커밋 생성: ${chalk.gray(commitMessage)}`);
    } else {
      console.log('⚠️  Git 저장소가 아니므로 커밋을 생성하지 않습니다.');
    }
    
    // 10. 완료 메시지
    console.log('\n🎉 버전 업데이트 완료!\n');
    console.log(`🏷️  새 버전: ${chalk.green.bold(versionInfo.next)}`);
    console.log(`📝 변경사항: ${changesets.length}개의 changeset 처리`);
    console.log(`📋 템플릿: ${chalk.cyan(changelogConfig.template)}`);
    
    if (gitManager.isGitRepository()) {
      console.log(`\n💡 다음 단계:`);
      console.log(`   ${chalk.dim('•')} vership publish로 배포를 진행하세요`);
      console.log(`   ${chalk.dim('•')} 또는 git push --follow-tags로 원격에 푸시하세요`);
    }
    
  } catch (error) {
    logger.error(`버전 업데이트 실패: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function performPreChecks(gitManager: GitManager, options: VersionOptions): Promise<void> {
  const checks = [];
  
  // Git 저장소 확인
  if (gitManager.isGitRepository()) {
    checks.push({
      name: 'Git 저장소',
      status: true,
      message: 'Git 저장소입니다'
    });
    
    // Working directory clean 확인 (CI 모드가 아닌 경우)
    if (!options.ci) {
      const isClean = gitManager.isWorkingDirectoryClean();
      checks.push({
        name: 'Working directory',
        status: isClean,
        message: isClean ? 'Working directory가 clean합니다' : 'Working directory에 uncommitted 변경사항이 있습니다'
      });
      
      if (!isClean) {
        throw new Error('Git working directory가 clean하지 않습니다. 변경사항을 커밋하거나 stash한 후 다시 시도하세요.');
      }
    }
  } else {
    checks.push({
      name: 'Git 저장소',
      status: false,
      message: 'Git 저장소가 아닙니다 (Git 커밋은 생성되지 않습니다)'
    });
  }
  
  // 확인 결과 표시
  checks.forEach(check => {
    const icon = check.status ? '✅' : '⚠️ ';
    console.log(`${icon} ${check.name}: ${check.message}`);
  });
  
  console.log();
}

function displayVersionPreview(versionInfo: any, changesets: any[]): void {
  console.log(`📊 버전 업데이트 미리보기\n`);
  
  console.log(`현재 버전: ${chalk.cyan(versionInfo.current)}`);
  console.log(`다음 버전: ${chalk.green.bold(versionInfo.next)}`);
  console.log(`처리할 changesets: ${changesets.length}개\n`);
  
  // 변경사항을 타입별로 분류하여 표시
  const byType = {
    major: changesets.filter(cs => cs.type === 'major'),
    minor: changesets.filter(cs => cs.type === 'minor'),
    patch: changesets.filter(cs => cs.type === 'patch'),
  };
  
  console.log('📝 변경사항:');
  
  if (byType.major.length > 0) {
    console.log(`\n${chalk.red.bold('💥 Breaking Changes')} (${byType.major.length}개):`);
    byType.major.forEach(cs => {
      console.log(`  • ${cs.summary} ${chalk.dim('(' + cs.id + ')')}`);
    });
  }
  
  if (byType.minor.length > 0) {
    console.log(`\n${chalk.yellow.bold('🚀 Features')} (${byType.minor.length}개):`);
    byType.minor.forEach(cs => {
      console.log(`  • ${cs.summary} ${chalk.dim('(' + cs.id + ')')}`);
    });
  }
  
  if (byType.patch.length > 0) {
    console.log(`\n${chalk.green.bold('🐛 Bug Fixes')} (${byType.patch.length}개):`);
    byType.patch.forEach(cs => {
      console.log(`  • ${cs.summary} ${chalk.dim('(' + cs.id + ')')}`);
    });
  }
}
