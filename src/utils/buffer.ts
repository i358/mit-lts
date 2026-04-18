export const toUTF8 = (buffer:any): string => {
return Buffer.from(buffer, "latin1").toString("utf-8");
}