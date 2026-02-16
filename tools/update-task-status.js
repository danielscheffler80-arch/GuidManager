#!/usr/bin/env node
/*
  Lightweight helper to update the TASKS.md status lines for a given step.
  Usage:
    node tools/update-task-status.js --step A1.3 --state completed
  This will search for a line containing "Schritt A1.3" and update the status marker
  to match the provided state (- [x], - [~], - [c], - [ ]).
*/
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--step=')) {
      out.step = a.split('=')[1];
    } else if (a.startsWith('--state=')) {
      out.state = a.split('=')[1];
    } else if (a.startsWith('--step')) {
      // --step A1.3 (next token)
      out.step = args[i+1];
      i++;
    } else if (a.startsWith('--state')) {
      out.state = args[i+1];
      i++;
    }
  }
  return out;
}

function lineForState(state) {
  switch ((state || '').toLowerCase()) {
    case 'completed': return '- [x]';
    case 'in_progress': return '- [~]';
    case 'cancelled': return '- [c]';
    default: return '- [ ]';
  }
}

function main() {
  const { step, state } = parseArgs();
  if (!step) {
    console.error('Missing --step argument (e.g. A1.3)');
    process.exit(1);
  }
  const TASKS_PATH = path.resolve(process.cwd(), 'TASKS.md');
  if (!fs.existsSync(TASKS_PATH)) {
    console.error('TASKS.md not found at project root');
    process.exit(1);
  }
  const content = fs.readFileSync(TASKS_PATH, 'utf8').split('\n');
  const marker = `Schritt ${step}`;
  let updated = false;
  for (let i = 0; i < content.length; i++) {
    const line = content[i];
    if (line.includes(marker)) {
      // Replace the leading checkbox token if present, preserving the rest of the line
      const symbol = lineForState(state);
      const updatedLine = line.replace(/^\s*- \[[ x~c]?\](.*)$/, (m, rest) => `${symbol}${rest}`);
      if (updatedLine !== line) {
        content[i] = updatedLine;
        updated = true;
      } else {
        // Fallback: attempt to replace with symbol + rest onwards
        content[i] = line.replace(/^\s*- \[[^\]]*\](.*)$/, (m, rest) => `${symbol}${rest}`);
        updated = true;
      }
      break;
    }
  }

  if (!updated) {
    console.error(`Could not find line with marker '${marker}' in TASKS.md`);
    process.exit(2);
  }

  fs.writeFileSync(TASKS_PATH, content.join('\n'));
  console.log(`TASKS.md updated for step ${step} -> ${state}`);
}

main();
