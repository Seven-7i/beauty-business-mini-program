# 美容模块视觉 token

`_tokens.scss` 是美容模块私有的编译期 token，只能由 `pages-beauty` 分包及其内部 feature 引用。它不会进入全局 `App.vue`，Sass 构建后也不存在需要在运行时加载的独立 token 文件。

后续新增业务模块应在自己的分包根目录建立同名 `styles/_tokens.scss`，不要复用美容模块的品牌色。跨模块真正共享的只应是无品牌含义的基础能力或组件。

优先使用语义名称：`surface`、`text`、`border`、`accent`、`status`、`focus`。只有同一语义在至少三个位置复用时才新增 token，避免把每个孤立数值都抽象化。
