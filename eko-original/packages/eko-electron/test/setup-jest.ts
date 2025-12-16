// Polyfill TransformStream for environments lacking Web Streams API
if (typeof (global as any).TransformStream === "undefined") {
  const { TransformStream } = require("stream/web");
  (global as any).TransformStream = TransformStream;
}
