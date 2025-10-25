declare module 'better-sqlite3' {
  export interface Statement<BindParameters extends any[] = any[], Result = any> {
    run(...params: BindParameters): Result;
    get(...params: BindParameters): Result;
    all(...params: BindParameters): Result[];
    pluck(value?: boolean): Statement<BindParameters, Result>;
  }

  export interface DatabaseOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
  }

  export default class Database {
    constructor(filename: string, options?: DatabaseOptions);
    prepare<BindParameters extends any[] = any[], Result = any>(
      source: string
    ): Statement<BindParameters, Result>;
    exec(source: string): void;
    pragma(source: string): void;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
  }
}

declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: unknown): void;
  export function readdirSync(path: string): string[];
}

declare module 'path' {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare module 'url' {
  export function fileURLToPath(url: string | URL): string;
}

declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
  exit(code?: number): never;
  on(event: string, listener: (...args: unknown[]) => void): void;
};

declare namespace NodeJS {
  type Timeout = number;
}

declare module 'crypto' {
  interface RandomBytesBuffer {
    toString(encoding: string): string;
  }

  interface Hmac {
    update(data: string | ArrayBufferView): Hmac;
    digest(encoding: string): string;
  }

  export function randomBytes(size: number): RandomBytesBuffer;
  export function createHmac(algorithm: string, key: string): Hmac;
}

type URL = any;

declare module 'discord.js' {
  export const ChannelType: Record<string, unknown>;
  export class Client {
    constructor(...args: unknown[]);
    on(event: string, listener: (...args: unknown[]) => void): this;
    once(event: string, listener: (...args: unknown[]) => void): this;
    login(token: string): Promise<void>;
    user: { id: string; tag: string } | null;
    channels: { fetch(id: string): Promise<TextBasedChannel | null> };
    commands: Map<string, unknown>;
  }
  export class Collection<K = unknown, V = unknown> extends Map<K, V> {}
  export const Events: Record<string, string>;
  export const GatewayIntentBits: Record<string, number>;
  export const MessageFlags: Record<string, number>;
  export const PermissionFlagsBits: Record<string, number>;
  export class REST {
    setToken(token: string): this;
    put(route: string, options: unknown): Promise<unknown>;
  }
  export const Routes: Record<string, (...args: unknown[]) => string>;
  export class SlashCommandBuilder {
    setName(name: string): this;
    setDescription(description: string): this;
    addStringOption(handler: (option: SlashCommandStringOption) => unknown): this;
    addIntegerOption(handler: (option: SlashCommandIntegerOption) => unknown): this;
    addSubcommand(handler: (subcommand: SlashCommandSubcommandBuilder) => unknown): this;
    setDefaultMemberPermissions(permissions: unknown): this;
    toJSON(): unknown;
  }
  export interface SlashCommandStringOption {
    setName(name: string): this;
    setDescription(description: string): this;
    setRequired(required: boolean): this;
    setMaxLength(length: number): this;
  }
  export interface SlashCommandIntegerOption {
    setName(name: string): this;
    setDescription(description: string): this;
    setRequired(required: boolean): this;
    setMinValue(value: number): this;
    setMaxValue(value: number): this;
  }
  export interface SlashCommandSubcommandBuilder {
    setName(name: string): this;
    setDescription(description: string): this;
    addStringOption(handler: (option: SlashCommandStringOption) => unknown): this;
    addIntegerOption(handler: (option: SlashCommandIntegerOption) => unknown): this;
  }
  export interface ChatInputCommandInteraction {
    commandName: string;
    channel?: { isTextBased(): boolean } | null;
    channelId: string;
    guildId: string | null;
    options: {
      getString(name: string, required: true): string;
      getString(name: string, required?: false): string | null;
      getInteger(name: string, required: true): number;
      getInteger(name: string, required?: false): number | null;
      getSubcommand(): string;
    };
    user: { id: string };
    replied: boolean;
    deferred: boolean;
    memberPermissions?: { has(permission: unknown): boolean };
    reply(options: unknown): Promise<void>;
    deferReply(options?: unknown): Promise<void>;
    editReply(options: unknown): Promise<void>;
    followUp(options: unknown): Promise<void>;
  }
  export interface ButtonInteraction {
    customId: string;
    message: Message;
    user: { id: string };
    replied: boolean;
    deferred: boolean;
    reply(options: unknown): Promise<void>;
    update(options: unknown): Promise<void>;
    deferUpdate(): Promise<void>;
    followUp(options: unknown): Promise<void>;
  }
  export interface TextBasedChannel {
    id: string;
    send(options: unknown): Promise<Message>;
    isTextBased(): boolean;
    type?: unknown;
  }
  export interface GuildTextBasedChannel extends TextBasedChannel {
    messages: { fetch(id: string): Promise<Message> };
  }
  export interface Message {
    id: string;
    channel: TextBasedChannel;
    delete(): Promise<void>;
    edit(options: unknown): Promise<Message>;
  }
  export interface InteractionReplyOptions {
    content?: string;
    embeds?: unknown[];
    components?: unknown[];
    ephemeral?: boolean;
  }
  export interface InteractionUpdateOptions extends InteractionReplyOptions {}
  export const ButtonStyle: Record<string, number>;
  export class ActionRowBuilder<T = unknown> {
    addComponents(...components: T[]): this;
  }
  export class ButtonBuilder {
    setCustomId(id: string): this;
    setLabel(label: string): this;
    setStyle(style: unknown): this;
    setEmoji(emoji: unknown): this;
    setDisabled(disabled: boolean): this;
  }
  export class EmbedBuilder {
    setTitle(title: string): this;
    setDescription(description: string): this;
    addFields(...fields: unknown[]): this;
    setColor(color: number): this;
    setFooter(footer: unknown): this;
    setTimestamp(timestamp?: Date): this;
    toJSON(): unknown;
  }
}
