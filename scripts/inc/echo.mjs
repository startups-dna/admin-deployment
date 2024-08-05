import chalk from 'chalk';
import figures from 'figures';

export const echo = {
  info: (msg) => console.log(`${figures.circle} ${msg}`),
  success: (msg) => console.log(chalk.green(`${figures.tick} ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`${figures.warning} ${msg}`)),
  error: (msg) => console.log(chalk.red(`${figures.cross} ${msg}`)),
};