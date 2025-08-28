// src/utils/logger.ts
import chalk from 'chalk';

export const logger = {
  info: (message: string) => console.log(chalk.blue('INFO'), message),
  success: (message: string) => console.log(chalk.green('SUCCESS'), message),
  warn: (message: string) => console.log(chalk.yellow('WARN'), message),
  error: (message: string) => console.log(chalk.red('ERROR'), message),
  debug: (message: string) => console.log(chalk.gray('DEBUG'), message),
};