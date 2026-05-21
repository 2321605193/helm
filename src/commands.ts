export interface CommandOpts {
  [key: string]: string | boolean;
}

export class Command {
  name: string;
  description: string;
  private _options: { flag: string; desc: string }[] = [];
  private _action: ((args: string[], opts: CommandOpts) => Promise<void>) | null = null;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  option(flag: string, desc = ""): this {
    this._options.push({ flag, desc });
    return this;
  }

  action(fn: (args: string[], opts: CommandOpts) => Promise<void>): this {
    this._action = fn;
    return this;
  }

  async run(args: string[]): Promise<void> {
    const positional: string[] = [];
    const opts: CommandOpts = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith("--")) {
        const key = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
          opts[key] = args[i + 1];
          i++;
        } else {
          opts[key] = true;
        }
      } else {
        positional.push(arg);
      }
    }
    if (!this._action) {
      throw new Error(`Command "${this.name}" has no action defined`);
    }
    await this._action(positional, opts);
  }
}
