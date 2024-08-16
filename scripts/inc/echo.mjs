import chalk from 'chalk';
import figures from 'figures';
import boxen from 'boxen';

export const echo = {
  log: (...msg) => console.log(figures.circle, ...msg),
  info: (...msg) => console.log(chalk.cyan(figures.info, ...msg)),
  success: (...msg) => console.log(chalk.green(figures.tick, ...msg)),
  warn: (...msg) => console.log(chalk.yellow(figures.warning, ...msg)),
  error: (...msg) => console.log(chalk.red(figures.cross, ...msg)),
  box: (msg, options = { padding: 1 }) => console.log(boxen(msg, options)),
  infoBox: (msg, options = { padding: 1 }) =>
    console.log(boxen(msg, { ...options, borderColor: 'cyan' })),
  successBox: (msg, options = { padding: 1 }) =>
    console.log(boxen(msg, { ...options, borderColor: 'green' })),
  warnBox: (msg, options = { padding: 1 }) =>
    console.log(boxen(msg, { ...options, borderColor: 'yellow' })),
  errorBox: (msg, options = { padding: 1 }) =>
    console.log(boxen(msg, { ...options, borderColor: 'red' })),
};
