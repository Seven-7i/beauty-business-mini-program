import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig(() => {
  const isWeixinMiniProgram = process.env.UNI_PLATFORM === "mp-weixin";

  return {
    plugins: [uni()],
    build: {
      // uView 3.6.10 的验证码组件在微信真机上无法解析压缩后的
      // `condition?.5:1` 表达式，导致整个组件静默为空。
      minify: isWeixinMiniProgram ? false : "esbuild",
    },
  };
});
