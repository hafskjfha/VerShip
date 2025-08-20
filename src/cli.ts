#!/usr/bin/env node

import { Command } from 'commander';
import { addCommand } from './commands/add';
//import { versionCommand } from './commands/version';
//import { publishCommand } from './commands/publish';
//import { statusCommand } from './commands/status';

const program = new Command();

program
  .name('VerShip')
  .description('Custom release management tool')
  .version('0.1.0');

program
  .command('add')
  .description('Add a new changeset')
  .option('-t, --type <type>', 'Change type (major|minor|patch)')
  .option('-m, --message <message>', 'Change description')
  .action(addCommand);

// program
//   .command('version')
//   .description('Update version and generate changelog')
//   .option('--dry-run', 'Show what would happen without making changes')
//   .action(versionCommand);

// program
//   .command('publish')
//   .description('Publish the release')
//   .option('--ci', 'Run in CI mode')
//   .option('--dry-run', 'Simulate publish without actually doing it')
//   .option('--skip-confirm', 'Skip confirmation prompts')
//   .action(publishCommand);

// program
//   .command('status')
//   .description('Show current project status')
//   .option('--output <format>', 'Output format (json|text)', 'text')
//   .action(statusCommand);

program.parse();