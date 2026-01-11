import os from "os";

export function getLocalIp() {
  return Object.values(os.networkInterfaces())
    .flat()
    .find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (iface: any) =>
        iface.family === "IPv4" &&
        iface.address !== "127.0.0.1" &&
        !iface.internal
    )?.address;
}
