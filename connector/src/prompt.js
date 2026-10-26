import readline from 'node:readline';

export async function prompt(label, { secret = false } = {}) {
  if (!secret) {
    const reader = readline.createInterface({ input: process.stdin, output: process.stdout });
    try { return await new Promise(resolve => reader.question(label, answer => resolve(answer.trim()))); }
    finally { reader.close(); }
  }
  if (!process.stdin.isTTY) throw new Error('Run the connector in your own interactive terminal to enter credentials.');
  process.stdout.write(label);
  const input = process.stdin;
  input.setRawMode(true); input.resume(); input.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => { input.off('data', onData); input.setRawMode(false); input.pause(); process.stdout.write('\n'); };
    const onData = chunk => {
      for (const character of chunk) {
        if (character === '\u0003') { finish(); reject(new Error('Cancelled')); return; }
        if (character === '\r' || character === '\n') { finish(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    input.on('data', onData);
  });
}
