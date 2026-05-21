export interface CommandOpts {
    [key: string]: string | boolean;
}
export declare class Command {
    name: string;
    description: string;
    private _options;
    private _action;
    constructor(name: string, description: string);
    option(flag: string, desc?: string): this;
    action(fn: (args: string[], opts: CommandOpts) => Promise<void>): this;
    run(args: string[]): Promise<void>;
}
//# sourceMappingURL=commands.d.ts.map