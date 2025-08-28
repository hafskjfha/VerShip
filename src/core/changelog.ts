import fs from 'fs/promises';
import path from 'path';
import { Changeset } from '../types/index.js';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    major: Changeset[];
    minor: Changeset[];
    patch: Changeset[];
  };
}

export class ChangelogManager {
  private cwd: string;
  private changelogPath: string;
  
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.changelogPath = path.join(cwd, 'CHANGELOG.md');
  }
  
  /**
   * 새로운 버전의 changelog 항목을 생성합니다
   */
  async addEntry(version: string, changesets: Changeset[]): Promise<void> {
    const entry = this.createChangelogEntry(version, changesets);
    const newContent = this.generateChangelogSection(entry);
    
    try {
      // 기존 changelog 읽기
      let existingContent = '';
      try {
        existingContent = await fs.readFile(this.changelogPath, 'utf-8');
      } catch {
        // 파일이 없으면 새로 생성
        existingContent = this.createInitialChangelog();
      }
      
      // 새 내용을 기존 내용 앞에 삽입
      const updatedContent = this.insertNewEntry(existingContent, newContent);
      
      await fs.writeFile(this.changelogPath, updatedContent);
    } catch (error) {
      throw new Error(`CHANGELOG.md 업데이트 실패: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * changelog 항목을 생성합니다
   */
  private createChangelogEntry(version: string, changesets: Changeset[]): ChangelogEntry {
    const changes = {
      major: changesets.filter(cs => cs.type === 'major'),
      minor: changesets.filter(cs => cs.type === 'minor'),
      patch: changesets.filter(cs => cs.type === 'patch'),
    };
    
    return {
      version,
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      changes
    };
  }
  
  /**
   * changelog 섹션을 생성합니다
   */
  private generateChangelogSection(entry: ChangelogEntry): string {
    const lines: string[] = [];
    
    lines.push(`## v${entry.version} (${entry.date})`);
    lines.push('');
    
    // Breaking Changes (major)
    if (entry.changes.major.length > 0) {
      lines.push('### 💥 Breaking Changes');
      lines.push('');
      entry.changes.major.forEach(changeset => {
        lines.push(`- ${changeset.summary}`);
      });
      lines.push('');
    }
    
    // Features (minor)
    if (entry.changes.minor.length > 0) {
      lines.push('### 🚀 Features');
      lines.push('');
      entry.changes.minor.forEach(changeset => {
        lines.push(`- ${changeset.summary}`);
      });
      lines.push('');
    }
    
    // Bug Fixes (patch)
    if (entry.changes.patch.length > 0) {
      lines.push('### 🐛 Bug Fixes');
      lines.push('');
      entry.changes.patch.forEach(changeset => {
        lines.push(`- ${changeset.summary}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * 초기 changelog 파일을 생성합니다
   */
  private createInitialChangelog(): string {
    return `# Changelog

모든 주목할 만한 변경사항들이 이 파일에 기록됩니다.

이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

`;
  }
  
  /**
   * 기존 changelog에 새 항목을 삽입합니다
   */
  private insertNewEntry(existingContent: string, newEntry: string): string {
    const lines = existingContent.split('\n');
    
    // "# Changelog" 제목 다음에 새 항목 삽입
    let insertIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('# Changelog')) {
        // 빈 줄들과 설명을 건너뛰고 첫 번째 ## 섹션 전에 삽입
        insertIndex = i + 1;
        while (insertIndex < lines.length && 
               (lines[insertIndex].trim() === '' || 
                lines[insertIndex].startsWith('모든 주목할') ||
                lines[insertIndex].startsWith('이 프로젝트는'))) {
          insertIndex++;
        }
        break;
      }
    }
    
    if (insertIndex === -1) {
      // "# Changelog" 헤더가 없으면 맨 앞에 추가
      return newEntry + '\n' + existingContent;
    }
    
    // 새 항목을 적절한 위치에 삽입
    const before = lines.slice(0, insertIndex);
    const after = lines.slice(insertIndex);
    
    return [...before, '', newEntry, ...after].join('\n');
  }
  
  /**
   * changelog 파일이 존재하는지 확인합니다
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.changelogPath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 특정 버전의 changelog 내용을 가져옵니다
   */
  async getVersionChangelog(version: string): Promise<string | null> {
    try {
      const content = await fs.readFile(this.changelogPath, 'utf-8');
      const lines = content.split('\n');
      
      let startIndex = -1;
      let endIndex = -1;
      
      // 해당 버전의 시작점 찾기
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(`## v${version}`)) {
          startIndex = i;
          break;
        }
      }
      
      if (startIndex === -1) return null;
      
      // 다음 버전 섹션이나 파일 끝까지 찾기
      for (let i = startIndex + 1; i < lines.length; i++) {
        if (lines[i].startsWith('## v')) {
          endIndex = i;
          break;
        }
      }
      
      if (endIndex === -1) endIndex = lines.length;
      
      return lines.slice(startIndex, endIndex).join('\n').trim();
    } catch {
      return null;
    }
  }
}
