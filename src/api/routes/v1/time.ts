import { FastifyInstance } from "fastify";
import { apiLogger as logger} from "../../../logger";
import base64url from "base64url";
import { getUser, updateUserTime } from "db_utilities";
import { config } from "../../../config";
import { authenticateRequest } from "../../utils/authMiddleware";
import { ext } from "../../../proxy/index";
import { getUserRow, getUserTime, updateUser } from "db_utilities/postgres";
import { HPacket } from "gnode-api";
import { globalStore } from "../../../utils";
import { updateUserWorkTime } from "db_utilities/work_time";

export default async function timeRoute(fastify: FastifyInstance) {

    fastify.get("users/:userid/time/fix", async (request, reply) => {
        try {
            let {type} = request.query as {type: string};
            let { uid } = request.params as {uid: string};
            if(!type) return reply.status(400).send({
                success: 0,
                error: 'Type query parameter is required. Valid values are "user_id" or "habbo_id".'
            });

            const result = await authenticateRequest(request as any);
            if (!result?.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'No token provided'
                });
            }

            const userId = parseInt(uid)
            if(!userId) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Invalid user ID'
                });
            }

            let userInStack = await getUserRow({
                in: type === "user_id" ? "id" : "habbo_id",
                value: userId,
                out:"habbo_id"
            })

            if (!userInStack) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Bu kullanıcı odada bulunamadı.'
                });
            }

            let clickPacket = new HPacket(`{out:ClickCharacter}{i:${userInStack}`)
            ext.sendToServer(clickPacket);
const globalCache = globalStore.collection("globalCache");
  
            setTimeout(async () =>{
                let timeData:any = await globalCache.get("time:" + userInStack);
                if (!timeData) {
                    return reply.status(404).send({
                        success: 0,
                        error: 'Kullanıcı süre verisi güncellenemedi. Tekrar deneyin.'
                    });
                }  
               //@ts-ignore
               let currentTime:any = await getUserTime(userInStack)
               currentTime = currentTime.storedTotal
               timeData = parseInt(timeData.time);
               const diff = currentTime - timeData;
                if(diff < 0) timeData = currentTime;
                await updateUserTime(userInStack, timeData);
                if(diff > 0){
                    await updateUserWorkTime(userInStack, diff)
                }else{
                    await updateUserWorkTime(userInStack, 0)
                }
                    return reply.send({
                        success: 1,
                        data: {
                            habboId: userInStack,
                            time: timeData
                        }
                    });


            }, 2000)


        }catch (error: any) {
            logger.error('Error fixing user time:', error);
            const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
            return reply.status(statusCode).send({
                success: 0,
                error: error?.message || 'Internal server error'
            });
        }
    })

}
