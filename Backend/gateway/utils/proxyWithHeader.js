import proxy from "express-http-proxy";

export const proxyWithHeader = (serviceUrl) => {
  return proxy(serviceUrl, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.user) {
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
        // Encoded because headers only allow ASCII (names can have accents etc.)
        proxyReqOpts.headers["x-user-name"] = encodeURIComponent(srcReq.user.name ?? "");
      }
      return proxyReqOpts;
    },
  });
};
