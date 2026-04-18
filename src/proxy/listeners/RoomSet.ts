import { Listener } from './listener';
import { proxyLogger } from '../../logger';
import { HDirection } from 'gnode-api';
import { globalStore } from '../../utils';

export const RoomReadyListener: Listener = {
    event: "RoomReady",
    direction: HDirection.TOCLIENT,
    async exec(message){

        const globalCache = globalStore.collection("globalCache");
        try{
            let {b} = globalCache.get("listenForRoomReady") as {b?: boolean};
        //proxyLogger.debug("RoomReadyListener executed", {b, s});
        if(b){
        let packet = message.getPacket();
        globalCache.emit("_SET", {i:1},{i:packet.read("Si")[1]});
        }
        }catch{
            
        }
    }
}
