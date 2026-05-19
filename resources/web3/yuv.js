var web3OriginalFetch = self.fetch.bind(self);
self.fetch = function(input, init) {
  if (input === "yuv.wasm") {
    return web3OriginalFetch("/webclient/yuv.wasm", init);
  }
  return web3OriginalFetch(input, init);
};
importScripts("/webclient/yuv.js");
