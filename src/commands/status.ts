import { ChangesetManager } from '../core/changeset.js';
import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { join } from 'path';

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
}

export async function statusCommand(options: StatusOptions = {}): Promise<void> {
  try {
    const manager = new ChangesetManager();
    const result = await getProjectStatus(manager);

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

async function getProjectStatus(manager: ChangesetManager): Promise<StatusResult> {
  // 현재 버전 읽기
  const currentVersion = getCurrentVersion();
  
  // 미처리 changesets 목록 가져오기
  const pendingChangesets = await manager.getAllChangesets();
  
  // 다음 버전 계산
  const nextVersion = calculateNextVersion(currentVersion, pendingChangesets);
  
  // Git 태그는 나중에 구현 (현재는 현재 버전과 동일하다고 가정)
  const latestTag = `v${currentVersion}`;
  
  return {
    currentVersion,
    latestTag,
    pendingChangesets: pendingChangesets.map(cs => ({
      id: cs.id,
      type: cs.type,
      summary: cs.summary,
      createdAt: cs.createdAt
    })),
    nextVersion,
    needsPublish: pendingChangesets.length > 0
  };
}

function getCurrentVersion(): string {
  try {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || '0.0.0';
  } catch (error) {
    logger.warn('package.json을 읽을 수 없습니다. 기본 버전 0.0.0을 사용합니다.');
    return '0.0.0';
  }
}

function calculateNextVersion(currentVersion: string, changesets: any[]): string {
  if (changesets.length === 0) {
    return currentVersion;
  }

  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  // 가장 높은 변경 타입 찾기
  const hasMajor = changesets.some(cs => cs.type === 'major');
  const hasMinor = changesets.some(cs => cs.type === 'minor');
  
  if (hasMajor) {
    return `${major + 1}.0.0`;
  } else if (hasMinor) {
    return `${major}.${minor + 1}.0`;
  } else {
    return `${major}.${minor}.${patch + 1}`;
  }
}

function displayTextStatus(result: StatusResult): void {
  console.log('📊 프로젝트 상태\n');
  
  console.log(`현재 버전: ${result.currentVersion}`);
  console.log(`최신 태그: ${result.latestTag}`);
  console.log(`미처리 changesets: ${result.pendingChangesets.length}개\n`);
  
  if (result.pendingChangesets.length > 0) {
    console.log('📝 대기 중인 변경사항:');
    result.pendingChangesets.forEach(cs => {
      const typeEmoji = getTypeEmoji(cs.type);
      console.log(`  ${typeEmoji} ${cs.type}: ${cs.summary} (${cs.id})`);
    });
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
