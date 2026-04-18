import { ClientEvents, Client } from "discord.js";

export interface Event {
    name: keyof ClientEvents;
    once?: boolean;
    exec(client: Client, ...args: any[]): Promise<void> | void;
}
