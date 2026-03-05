#!/bin/bash
# 安装 oxlint 和 oxfmt 二进制文件

set -e

echo "正在安装 oxlint 和 oxfmt..."

# 检测平台
ARCH="$(uname -m)"
OS="$(uname -s)"

case "$ARCH" in
  x86_64|amd64)
    ARCH="x86_64"
    ;;
  aarch64|arm64)
    ARCH="aarch64"
    ;;
  *)
    echo "不支持的架构: $ARCH"
    exit 1
    ;;
esac

case "$OS" in
  Darwin)
    OS="apple-darwin"
    ;;
  Linux)
    OS="unknown-linux-gnu"
    ;;
  *)
    echo "不支持的系统: $OS"
    exit 1
    ;;
esac

# 创建 bin 目录
mkdir -p bin

# 下载 oxlint
OXLINT_URL="https://github.com/oxc-project/oxc/releases/latest/download/oxlint-${ARCH}-${OS}"
echo "下载 oxlint 从: $OXLINT_URL"
curl -fsSL "$OXLINT_URL" -o bin/oxlint
chmod +x bin/oxlint

# oxfmt 已集成在 oxlint 中
echo "✓ oxlint/oxfmt 安装完成！"
echo ""
echo "使用方法:"
echo "  npm run lint      # 运行 oxlint 检查"
echo "  npm run lint:fix  # 自动修复问题"
echo "  npm run format    # 格式化代码"
echo "  npm run check     # 检查代码质量"
echo "  npm run fix       # 自动修复所有问题"
