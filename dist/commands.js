export class Command {
    name;
    description;
    _options = [];
    _action = null;
    constructor(name, description) {
        this.name = name;
        this.description = description;
    }
    option(flag, desc = "") {
        this._options.push({ flag, desc });
        return this;
    }
    action(fn) {
        this._action = fn;
        return this;
    }
    async run(args) {
        const positional = [];
        const opts = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith("--")) {
                // Normalize kebab-case flags to camelCase keys so actions can read
                // them as opts.dryRun rather than opts["dry-run"].
                const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
                    opts[key] = args[i + 1];
                    i++;
                }
                else {
                    opts[key] = true;
                }
            }
            else {
                positional.push(arg);
            }
        }
        if (!this._action) {
            throw new Error(`Command "${this.name}" has no action defined`);
        }
        await this._action(positional, opts);
    }
}
//# sourceMappingURL=commands.js.map