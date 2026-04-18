import { HDirection, HMessage } from "gnode-api";

export interface Listener {
    event: string;
    direction: HDirection;
    async exec(message: HMessage);
}
