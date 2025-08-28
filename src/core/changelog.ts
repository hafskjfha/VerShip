import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
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

export interface ChangelogConfig {
  template: 'default' | 'github' | 'conventional' | 'custom';
  customTemplatePath?: string;
  includeCommitLinks?: boolean;
  includeAuthor?: boolean;
  includePR?: boolean;
  repository?: {
    owner: string;
    name: string;
    provider: 'github' | 'gitlab' | 'bitbucket';
  };
  categories?: {
    major?: string;
    minor?: string;
    patch?: string;
  };
}

export class ChangelogManager {
  private cwd: string;
  private changelogPath: string;
  private config: ChangelogConfig;
  
  constructor(cwd = process.cwd(), config?: Partial<ChangelogConfig>) {
    this.cwd = cwd;
    this.changelogPath = path.join(cwd, 'CHANGELOG.md');
    this.config = {
      template: 'default',
      includeCommitLinks: false,
      includeAuthor: false,
      includePR: false,
      categories: {
        major: '💥 Breaking Changes',
        minor: '🚀 Features',
        patch: '🐛 Bug Fixes'
      },
      ...config
    };
    
    this.registerHandlebarsHelpers();
  }
  
  /**
   * 새로운 버전의 changelog 항목을 생성합니다
   */
  async addEntry(version: string, changesets: Changeset[]): Promise<void> {
    const entry = this.createChangelogEntry(version, changesets);
    const newContent = await this.generateChangelogSection(entry);
    
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
   * 설정을 업데이트합니다
   */
  updateConfig(config: Partial<ChangelogConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * GitHub/GitLab 저장소 정보를 자동으로 감지합니다
   */
  async detectRepository(): Promise<void> {
    try {
      const packageJsonPath = path.join(this.cwd, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      if (packageJson.repository) {
        const repoUrl = typeof packageJson.repository === 'string' 
          ? packageJson.repository 
          : packageJson.repository.url;
          
        if (repoUrl) {
          const match = repoUrl.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)\/([^\/]+)\/([^\/\.]+)/);
          if (match) {
            const [, provider, owner, name] = match;
            
            let detectedProvider: 'github' | 'gitlab' | 'bitbucket' = 'github';
            if (provider.includes('gitlab')) detectedProvider = 'gitlab';
            else if (provider.includes('bitbucket')) detectedProvider = 'bitbucket';
            
            this.config.repository = {
              provider: detectedProvider,
              owner,
              name: name.replace(/\.git$/, '')
            };
          }
        }
      }
    } catch {
      // 자동 감지 실패는 무시
    }
  }
  
  /**
   * Handlebars 헬퍼를 등록합니다
   */
  private registerHandlebarsHelpers(): void {
    // 날짜 포맷 헬퍼
    Handlebars.registerHelper('dateFormat', (date: string, format: string) => {
      const d = new Date(date);
      switch (format) {
        case 'yyyy-mm-dd':
          return d.toISOString().split('T')[0];
        case 'long':
          return d.toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        default:
          return d.toISOString().split('T')[0];
      }
    });
    
    // URL 생성 헬퍼
    Handlebars.registerHelper('commitUrl', (commit: string) => {
      if (!this.config.repository) return commit;
      const { provider, owner, name } = this.config.repository;
      
      switch (provider) {
        case 'github':
          return `https://github.com/${owner}/${name}/commit/${commit}`;
        case 'gitlab':
          return `https://gitlab.com/${owner}/${name}/-/commit/${commit}`;
        case 'bitbucket':
          return `https://bitbucket.org/${owner}/${name}/commits/${commit}`;
        default:
          return commit;
      }
    });
    
    // PR/MR 링크 헬퍼
    Handlebars.registerHelper('prUrl', (pr: number) => {
      if (!this.config.repository) return `#${pr}`;
      const { provider, owner, name } = this.config.repository;
      
      switch (provider) {
        case 'github':
          return `https://github.com/${owner}/${name}/pull/${pr}`;
        case 'gitlab':
          return `https://gitlab.com/${owner}/${name}/-/merge_requests/${pr}`;
        case 'bitbucket':
          return `https://bitbucket.org/${owner}/${name}/pull-requests/${pr}`;
        default:
          return `#${pr}`;
      }
    });
    
    // 비교 링크 헬퍼
    Handlebars.registerHelper('compareUrl', (from: string, to: string) => {
      if (!this.config.repository) return '';
      const { provider, owner, name } = this.config.repository;
      
      switch (provider) {
        case 'github':
          return `https://github.com/${owner}/${name}/compare/${from}...${to}`;
        case 'gitlab':
          return `https://gitlab.com/${owner}/${name}/-/compare/${from}...${to}`;
        case 'bitbucket':
          return `https://bitbucket.org/${owner}/${name}/branches/compare/${to}..${from}`;
        default:
          return '';
      }
    });
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
  private async generateChangelogSection(entry: ChangelogEntry): Promise<string> {
    // 저장소 정보 자동 감지
    await this.detectRepository();
    
    switch (this.config.template) {
      case 'github':
        return this.generateGitHubTemplate(entry);
      case 'conventional':
        return this.generateConventionalTemplate(entry);
      case 'custom':
        return await this.generateCustomTemplate(entry);
      default:
        return this.generateDefaultTemplate(entry);
    }
  }
  
  /**
   * 기본 템플릿을 생성합니다
   */
  private generateDefaultTemplate(entry: ChangelogEntry): string {
    const lines: string[] = [];
    
    lines.push(`## v${entry.version} (${entry.date})`);
    lines.push('');
    
    // Breaking Changes (major)
    if (entry.changes.major.length > 0) {
      lines.push(`### ${this.config.categories?.major || '💥 Breaking Changes'}`);
      lines.push('');
      entry.changes.major.forEach(changeset => {
        lines.push(`- ${changeset.summary}`);
      });
      lines.push('');
    }
    
    // Features (minor)
    if (entry.changes.minor.length > 0) {
      lines.push(`### ${this.config.categories?.minor || '🚀 Features'}`);
      lines.push('');
      entry.changes.minor.forEach(changeset => {
        lines.push(`- ${changeset.summary}`);
      });
      lines.push('');
    }
    
    // Bug Fixes (patch)
    if (entry.changes.patch.length > 0) {
      lines.push(`### ${this.config.categories?.patch || '🐛 Bug Fixes'}`);
      lines.push('');
      entry.changes.patch.forEach(changeset => {
        lines.push(`- ${changeset.summary}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * GitHub 스타일 템플릿을 생성합니다
   */
  private generateGitHubTemplate(entry: ChangelogEntry): string {
    const templateSource = `
## [v{{version}}]({{compareUrl}}) ({{dateFormat date 'yyyy-mm-dd'}})

{{#if changes.major}}
### 💥 Breaking Changes

{{#each changes.major}}
- {{summary}}{{#if ../config.includeAuthor}}{{#if author}} by @{{author}}{{/if}}{{/if}}{{#if ../config.includePR}}{{#if pr}} ([#{{pr}}]({{prUrl pr}})){{/if}}{{/if}}
{{/each}}

{{/if}}
{{#if changes.minor}}
### 🚀 New Features

{{#each changes.minor}}
- {{summary}}{{#if ../config.includeAuthor}}{{#if author}} by @{{author}}{{/if}}{{/if}}{{#if ../config.includePR}}{{#if pr}} ([#{{pr}}]({{prUrl pr}})){{/if}}{{/if}}
{{/each}}

{{/if}}
{{#if changes.patch}}
### 🐛 Bug Fixes

{{#each changes.patch}}
- {{summary}}{{#if ../config.includeAuthor}}{{#if author}} by @{{author}}{{/if}}{{/if}}{{#if ../config.includePR}}{{#if pr}} ([#{{pr}}]({{prUrl pr}})){{/if}}{{/if}}
{{/each}}

{{/if}}
`.trim();

    const template = Handlebars.compile(templateSource);
    return template({
      version: entry.version,
      date: entry.date,
      changes: entry.changes,
      config: this.config,
      compareUrl: this.config.repository ? 
        `https://github.com/${this.config.repository.owner}/${this.config.repository.name}/compare/v${entry.version}` : 
        ''
    });
  }
  
  /**
   * Conventional Commits 스타일 템플릿을 생성합니다
   */
  private generateConventionalTemplate(entry: ChangelogEntry): string {
    const templateSource = `
## [{{version}}]({{compareUrl}}) ({{dateFormat date 'yyyy-mm-dd'}})

{{#if changes.major}}
### ⚠ BREAKING CHANGES

{{#each changes.major}}
* {{summary}}
{{/each}}

{{/if}}
{{#if changes.minor}}
### Features

{{#each changes.minor}}
* {{summary}}
{{/each}}

{{/if}}
{{#if changes.patch}}
### Bug Fixes

{{#each changes.patch}}
* {{summary}}
{{/each}}

{{/if}}
`.trim();

    const template = Handlebars.compile(templateSource);
    return template({
      version: entry.version,
      date: entry.date,
      changes: entry.changes,
      compareUrl: this.config.repository ? 
        `https://github.com/${this.config.repository.owner}/${this.config.repository.name}/compare/v${entry.version}` : 
        ''
    });
  }
  
  /**
   * 커스텀 템플릿을 생성합니다
   */
  private async generateCustomTemplate(entry: ChangelogEntry): Promise<string> {
    if (!this.config.customTemplatePath) {
      throw new Error('커스텀 템플릿 경로가 설정되지 않았습니다.');
    }
    
    try {
      const templatePath = path.resolve(this.cwd, this.config.customTemplatePath);
      const templateSource = await fs.readFile(templatePath, 'utf-8');
      const template = Handlebars.compile(templateSource);
      
      return template({
        version: entry.version,
        date: entry.date,
        changes: entry.changes,
        config: this.config,
        repository: this.config.repository
      });
    } catch (error) {
      throw new Error(`커스텀 템플릿 로드 실패: ${error instanceof Error ? error.message : error}`);
    }
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
