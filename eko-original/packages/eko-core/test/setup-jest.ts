// Polyfill Web APIs for Node.js test environment
if (typeof (global as any).TransformStream === "undefined") {
  const { TransformStream } = require("stream/web");
  (global as any).TransformStream = TransformStream;
}

if (typeof (global as any).ReadableStream === "undefined") {
  const { ReadableStream } = require("stream/web");
  (global as any).ReadableStream = ReadableStream;
}

if (typeof (global as any).WritableStream === "undefined") {
  const { WritableStream } = require("stream/web");
  (global as any).WritableStream = WritableStream;
}

if (typeof (global as any).TextDecoderStream === "undefined") {
  const { TextDecoderStream } = require("stream/web");
  (global as any).TextDecoderStream = TextDecoderStream;
}

if (typeof (global as any).TextEncoderStream === "undefined") {
  const { TextEncoderStream } = require("stream/web");
  (global as any).TextEncoderStream = TextEncoderStream;
}

if (typeof (global as any).Headers === "undefined") {
  const { Headers } = require("undici");
  (global as any).Headers = Headers;
}

if (typeof (global as any).Response === "undefined") {
  const { Response } = require("undici");
  (global as any).Response = Response;
}

if (typeof (global as any).Request === "undefined") {
  const { Request } = require("undici");
  (global as any).Request = Request;
}

if (typeof (global as any).fetch === "undefined") {
  const { fetch } = require("undici");
  (global as any).fetch = fetch;
}
