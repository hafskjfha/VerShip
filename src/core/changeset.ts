// src/core/changeset.ts
import fs from 'fs/promises';
import path from 'path';
import { Changeset, ChangeType } from '../types';
import { ensureDir, writeJsonFile, readJsonFile } from '../utils/fs';

const CHANGESETS_DIR = '.changesets';

export class ChangesetManager {
  private changesetsDir: string;

  constructor(cwd = process.cwd()) {
    this.changesetsDir = path.join(cwd, CHANGESETS_DIR);
  }

  async init(): Promise<void> {
    await ensureDir(this.changesetsDir);
    
    const configPath = path.join(this.changesetsDir, 'config.json');
    try {
      await fs.access(configPath);
    } catch {
      await writeJsonFile(configPath, {
        // $schema: 'https://unpkg.com/my-release-tool/schema.json', // later...
        changelog: {
          repo: '',
          template: 'default'
        }
      });
    }
  }

  async createChangeset(type: ChangeType, summary: string): Promise<Changeset> {
    await this.init();

    // Validate input
    this.validateChangesetInput(type, summary);

    const id = await this.generateUniqueId();
    const changeset: Changeset = {
      id,
      type,
      summary: summary.trim(),
      createdAt: new Date().toISOString(),
    };

    const filename = `${id}.json`;
    const filePath = path.join(this.changesetsDir, filename);
    
    await writeJsonFile(filePath, changeset);
    return changeset;
  }

  async getAllChangesets(): Promise<Changeset[]> {
    await this.init();
    
    try {
      const files = await fs.readdir(this.changesetsDir);
      const changesetFiles = files.filter(f => f.endsWith('.json') && f !== 'config.json');
      
      const changesets: Changeset[] = [];
      for (const file of changesetFiles) {
        const filePath = path.join(this.changesetsDir, file);
        try {
          const changeset = await readJsonFile<Changeset>(filePath);
          // Validate changeset structure
          this.validateChangesetStructure(changeset, file);
          changesets.push(changeset);
        } catch (error) {
          console.warn(`⚠️  잘못된 changeset 파일을 건너뜁니다: ${file} (${error instanceof Error ? error.message : error})`);
        }
      }
      
      return changesets.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async consumeChangesets(): Promise<Changeset[]> {
    const changesets = await this.getAllChangesets();

    // remove processed changesets
    for (const changeset of changesets) {
      const filePath = path.join(this.changesetsDir, `${changeset.id}.json`);
      await fs.unlink(filePath);
    }
    
    return changesets;
  }

  private generateId(): string {
    const adjectives = [
      'happy', 'funny', 'clever', 'brave', 'kind', 'swift',
      'bright', 'calm', 'eager', 'gentle', 'jolly', 'keen',
      'lively', 'merry', 'noble', 'proud', 'quick', 'wise'
    ];
    const animals = [
      'cats', 'dogs', 'birds', 'fish', 'lions', 'tigers',
      'bears', 'wolves', 'foxes', 'deer', 'owls', 'hawks',
      'dolphins', 'whales', 'pandas', 'koalas', 'rabbits', 'squirrels'
    ];
    const actions = [
      'dance', 'run', 'jump', 'fly', 'swim', 'sing',
      'play', 'laugh', 'smile', 'explore', 'discover', 'create',
      'build', 'shine', 'soar', 'bloom', 'thrive', 'sparkle'
    ];
    
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    return `${adj}-${animal}-${action}`;
  }

  private async generateUniqueId(): Promise<string> {
    let id = this.generateId();
    let attempts = 0;
    const maxAttempts = 50;

    // Ensure the ID is unique
    while (attempts < maxAttempts) {
      const filePath = path.join(this.changesetsDir, `${id}.json`);
      try {
        await fs.access(filePath);
        // File exists, generate new ID
        id = this.generateId();
        attempts++;
      } catch {
        // File doesn't exist, ID is unique
        break;
      }
    }

    if (attempts >= maxAttempts) {
      throw new Error('고유한 changeset ID를 생성할 수 없습니다. 다시 시도해주세요.');
    }

    return id;
  }

  private validateChangesetStructure(changeset: any, filename: string): void {
    if (!changeset || typeof changeset !== 'object') {
      throw new Error('유효하지 않은 JSON 구조입니다.');
    }

    const requiredFields = ['id', 'type', 'summary', 'createdAt'];
    for (const field of requiredFields) {
      if (!(field in changeset)) {
        throw new Error(`필수 필드가 누락되었습니다: ${field}`);
      }
    }

    if (typeof changeset.id !== 'string' || !changeset.id.trim()) {
      throw new Error('id는 비어있지 않은 문자열이어야 합니다.');
    }

    const validTypes: ChangeType[] = ['major', 'minor', 'patch'];
    if (!validTypes.includes(changeset.type)) {
      throw new Error(`유효하지 않은 타입입니다: ${changeset.type}`);
    }

    if (typeof changeset.summary !== 'string' || !changeset.summary.trim()) {
      throw new Error('summary는 비어있지 않은 문자열이어야 합니다.');
    }

    if (typeof changeset.createdAt !== 'string') {
      throw new Error('createdAt은 문자열이어야 합니다.');
    }

    // Validate ISO date string
    const date = new Date(changeset.createdAt);
    if (isNaN(date.getTime())) {
      throw new Error('createdAt은 유효한 ISO 날짜 문자열이어야 합니다.');
    }

    // Check if filename matches the ID
    const expectedFilename = `${changeset.id}.json`;
    if (filename !== expectedFilename) {
      throw new Error(`파일명이 ID와 일치하지 않습니다. 예상: ${expectedFilename}, 실제: ${filename}`);
    }
  }

  private validateChangesetInput(type: ChangeType, summary: string): void {
    const validTypes: ChangeType[] = ['major', 'minor', 'patch'];
    if (!validTypes.includes(type)) {
      throw new Error(`유효하지 않은 변경 타입입니다: ${type}`);
    }

    const trimmedSummary = summary.trim();
    if (!trimmedSummary) {
      throw new Error('변경사항 설명이 비어있습니다.');
    }

    if (trimmedSummary.length < 5) {
      throw new Error('변경사항 설명은 최소 5자 이상이어야 합니다.');
    }

    if (trimmedSummary.length > 200) {
      throw new Error('변경사항 설명은 200자를 초과할 수 없습니다.');
    }

    // Check for potentially problematic characters
    if (trimmedSummary.includes('\n') || trimmedSummary.includes('\r')) {
      throw new Error('변경사항 설명에는 줄바꿈 문자를 포함할 수 없습니다.');
    }
  }
}