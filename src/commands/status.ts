import { ChangesetManager } from '../core/changeset.js';
import { VersionManager } from '../core/version.js';
import { GitManager } from '../utils/git.js';
import { logger } from '../utils/logger.js';

interface StatusOptions {
  output?: 'text' | 'json';
}

interface StatusResult {
  currentVersion: string;
  latestTag?: string;
  pendingChangesets: Array<{
    id: string;
    type: string;
    summary: string;
    createdAt: string;
  }>;
  nextVersion: string;
  needsPublish: boolean;
  changesByType: {
    major: number;
    minor: number;
    patch: number;
  };
}

export async function statusCommand(options: StatusOptions = {}): Promise<void> {
  try {
    const changesetManager = new ChangesetManager();
    const versionManager = new VersionManager();
    const gitManager = new GitManager();
    
    const result = await getProjectStatus(changesetManager, versionManager, gitManager);

    if (options.output === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      displayTextStatus(result);
    }
  } catch (error) {
    logger.error(`상태 확인 중 오류가 발생했습니다: ${error}`);
    process.exit(1);
  }
}

async function getProjectStatus(
  changesetManager: ChangesetManager, 
  versionManager: VersionManager,
  gitManager: GitManager
): Promise<StatusResult> {
  // 현재 버전 읽기
  const currentVersion = await versionManager.getCurrentVersion();
  
  // 미처리 changesets 목록 가져오기
  const pendingChangesets = await changesetManager.getAllChangesets();
  
  // 다음 버전 계산
  const versionInfo = versionManager.calculateNextVersion(currentVersion, pendingChangesets);
  
  // Git 태그 확인
  let latestTag: string | undefined;
  if (gitManager.isGitRepository()) {
    latestTag = gitManager.getLatestTag() || undefined;
  }
  
  return {
    currentVersion,
    latestTag,
    pendingChangesets: pendingChangesets.map(cs => ({
      id: cs.id,
      type: cs.type,
      summary: cs.summary,
      createdAt: cs.createdAt
    })),
    nextVersion: versionInfo.next,
    needsPublish: versionInfo.hasChanges,
    changesByType: versionInfo.changesByType
  };
}

function displayTextStatus(result: StatusResult): void {
  console.log('📊 프로젝트 상태\n');
  
  console.log(`현재 버전: ${result.currentVersion}`);
  if (result.latestTag) {
    console.log(`최신 태그: ${result.latestTag}`);
  }
  console.log(`미처리 changesets: ${result.pendingChangesets.length}개\n`);
  
  if (result.pendingChangesets.length > 0) {
    console.log('📝 대기 중인 변경사항:');
    
    // 타입별로 정렬하여 표시
    const sorted = [...result.pendingChangesets].sort((a, b) => {
      const typeOrder = { major: 0, minor: 1, patch: 2 };
      return typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
    });
    
    sorted.forEach(cs => {
      const typeEmoji = getTypeEmoji(cs.type);
      console.log(`  ${typeEmoji} ${cs.type}: ${cs.summary} (${cs.id})`);
    });
    console.log();
    
    // 변경사항 요약
    if (result.changesByType.major > 0) {
      console.log(`💥 Breaking Changes: ${result.changesByType.major}개`);
    }
    if (result.changesByType.minor > 0) {
      console.log(`🚀 Features: ${result.changesByType.minor}개`);
    }
    if (result.changesByType.patch > 0) {
      console.log(`🐛 Bug Fixes: ${result.changesByType.patch}개`);
    }
    console.log();
    
    console.log(`🚀 예상 다음 버전: ${result.nextVersion}`);
    console.log(`${result.needsPublish ? '✅' : '❌'} 릴리즈 필요: ${result.needsPublish ? '예' : '아니오'}`);
  } else {
    console.log('📝 대기 중인 변경사항이 없습니다.');
    console.log('❌ 릴리즈 필요: 아니오');
  }
}

function getTypeEmoji(type: string): string {
  switch (type) {
    case 'major':
      return '💥';
    case 'minor':
      return '🚀';
    case 'patch':
      return '🐛';
    default:
      return '•';
  }
}
