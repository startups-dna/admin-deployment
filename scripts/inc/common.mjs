import chalk from 'chalk';

export function handleError(error) {
  if (error instanceof Error) {
    console.error(chalk.red(error.stack));
  } else {
    console.error(chalk.red(error));
  }
  process.exit(1);
}
